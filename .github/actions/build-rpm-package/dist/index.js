"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const exec_1 = require("@actions/exec");
const promises_1 = require("fs/promises");
const path_1 = require("path");
// As with the apt package, this is based on the Twilio CLI logic for generating an RPM package.
// As is, it appears only x64 systems are supported by this RPM package.
const defaultGPGConfig = `default-cache-ttl 7200
max-cache-ttl 31536000
allow-preset-passphrase`;
const rpmBuildTmp = `${process.env.HOME}/rpmbuild`;
const rpmSourcesTmp = `${rpmBuildTmp}/SOURCES`;
const targetRpmBuildTmp = `${rpmBuildTmp}/RPMS`;
const outputRpmDir = `${process.env.GITHUB_WORKSPACE}/RPMS`;
const importPrivateKey = async () => {
    (0, core_1.debug)('Importing GPG private key...');
    const keyFilePath = 'private.gpg';
    const gpgPrivateKey = Buffer.from((0, core_1.getInput)('gpg_private_key', {
        required: true,
    }), 'base64').toString('utf8');
    await (0, promises_1.writeFile)(keyFilePath, gpgPrivateKey);
    const res = await (0, exec_1.exec)('gpg', [
        '--import',
        '--batch',
        '--yes',
        keyFilePath,
    ], { ignoreReturnCode: true, silent: true });
    if (res !== 0) {
        throw new Error('importing key failed');
    }
};
const configureGPGAgent = async () => {
    (0, core_1.debug)('Configuring GnuPG agent...');
    const confFilePath = (0, path_1.join)(process.env.HOME || '/', '.gnupg', 'gpg-agent.conf');
    await (0, promises_1.writeFile)(confFilePath, defaultGPGConfig);
    // Restart GPG agent so config changes can take affect.
    const res = await (0, exec_1.getExecOutput)('gpg-connect-agent', [
        'RELOADAGENT',
        '/bye',
    ], { silent: true, ignoreReturnCode: true });
    if (res.exitCode != 0 && res.stderr) {
        throw new Error(res.stderr);
    }
    const outputLines = res.stdout.replaceAll(/\r/g, '').trim().split('\n');
    const errorLine = outputLines.find((line) => line.trim().startsWith('ERR'));
    if (errorLine) {
        throw new Error(errorLine);
    }
};
const findFilesByExt = async (base, ext) => {
    const dirFiles = await (0, promises_1.readdir)(base);
    const files = [];
    await Promise.all(dirFiles.map(async (dirFile) => {
        const filePath = (0, path_1.join)(base, dirFile);
        const fileStat = await (0, promises_1.stat)(filePath);
        if (fileStat.isDirectory()) {
            files.push(...await findFilesByExt(filePath, ext));
        }
        else if (filePath.split('.').pop() === ext) {
            files.push(filePath);
        }
    }));
    return files;
};
const buildPackage = async () => {
    (0, core_1.debug)('Initializing rpmbuild tree...');
    await (0, exec_1.exec)('rpmdev-setuptree');
    const specFile = (0, core_1.getInput)('spec_file');
    const targetSpecFile = `${rpmBuildTmp}/SPECS/${(0, path_1.basename)(specFile)}`;
    (0, core_1.debug)('Copying spec file...');
    await (0, promises_1.copyFile)(specFile, targetSpecFile);
    (0, core_1.debug)('Copying sources...');
    const sources = (0, core_1.getInput)('sources').split('\n');
    await Promise.all(sources.map((src) => (0, promises_1.copyFile)(src, `${rpmSourcesTmp}/${(0, path_1.basename)(src)}`)));
    await (0, promises_1.mkdir)(outputRpmDir, { recursive: true });
    (0, core_1.debug)('Running rpmbuild...');
    const templateVariables = (0, core_1.getInput)('template_variables').split('\n').map((line) => {
        const tuple = line.trim().split('=');
        return {
            name: tuple[0],
            value: tuple[1],
        };
    });
    const res = await (0, exec_1.exec)('rpmbuild', [
        '-bb',
        ...templateVariables.flatMap((v) => ['-D', `${v.name} ${v.value}`]),
        targetSpecFile,
    ]);
    if (res !== 0) {
        throw new Error('rpmbuild failed');
    }
    const builtRPMFilePath = (await findFilesByExt(targetRpmBuildTmp, 'rpm'))[0];
    await (0, exec_1.exec)('rpmsign', [
        '--define',
        `_gpg_name ${(0, core_1.getInput)('gpg_key_id')}`,
        '--define',
        `__gpg_sign_cmd %{__gpg} gpg --no-armor --batch --pinentry-mode loopback --no-tty --yes --passphrase ${(0, core_1.getInput)('gpg_passphrase')} -u "%{_gpg_name}" -sbo %{__signature_filename} %{__plaintext_filename}`,
        '--resign',
        builtRPMFilePath,
    ]);
    (0, core_1.debug)('Copying to output dir...');
    await (0, promises_1.copyFile)(builtRPMFilePath, `${outputRpmDir}/${(0, path_1.basename)(builtRPMFilePath)}`);
    (0, core_1.setOutput)('rpm_package_name', (0, path_1.basename)(builtRPMFilePath));
    (0, core_1.setOutput)('rpm_package_path', `RPMS/${(0, path_1.basename)(builtRPMFilePath)}`);
};
(async () => {
    const specFiles = (0, core_1.getInput)('spec_file', {
        required: true,
    }).split('\n');
    const templateVariables = (0, core_1.getInput)('template_vars', {
        required: true,
    }).split('\n');
    const privateKeyPassphrase = (0, core_1.getInput)('gpg_passphrase');
    await importPrivateKey();
    if (privateKeyPassphrase) {
        await configureGPGAgent();
    }
    await buildPackage();
    (0, core_1.debug)('Done');
})();
