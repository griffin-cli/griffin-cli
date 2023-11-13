import { debug, getInput, setOutput } from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
import { copyFile, mkdir, readdir, stat, writeFile } from 'fs/promises';
import { basename, join } from 'path';

// As with the apt package, this is based on the Twilio CLI logic for generating an RPM package.
// As is, it appears only x64 systems are supported by this RPM package.

const defaultGPGConfig = `default-cache-ttl 7200
max-cache-ttl 31536000
allow-preset-passphrase`;

const rpmBuildTmp = `${process.env.HOME}/rpmbuild`;
const rpmSourcesTmp = `${rpmBuildTmp}/SOURCES`;
const targetRpmBuildTmp = `${rpmBuildTmp}/RPMS`;
const outputRpmDir = `${process.env.GITHUB_WORKSPACE}/RPMS`;

const importPrivateKey = async (): Promise<void> => {
  debug('Importing GPG private key...');

  const keyFilePath = 'private.gpg';
  const gpgPrivateKey = Buffer.from(getInput('gpg_private_key', {
    required: true,
  }), 'base64').toString('utf8');

  await writeFile(keyFilePath, gpgPrivateKey);

  const res = await exec('gpg', [
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
  debug('Configuring GnuPG agent...');

  const confFilePath = join(process.env.HOME || '/', '.gnupg', 'gpg-agent.conf');

  await writeFile(confFilePath, defaultGPGConfig);

  // Restart GPG agent so config changes can take affect.
  const res = await getExecOutput('gpg-connect-agent', [
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

const findFilesByExt = async (
  base: string,
  ext: string,
): Promise<string[]> => {
  const dirFiles = await readdir(base);
  const files: string[] = [];

  await Promise.all(dirFiles.map(async (dirFile) => {
    const filePath = join(base, dirFile);
    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      files.push(...await findFilesByExt(filePath, ext));
    } else if (filePath.split('.').pop() === ext) {
      files.push(filePath);
    }
  }));

  return files;
}

const buildPackage = async () => {
  debug('Initializing rpmbuild tree...');
  await exec('rpmdev-setuptree');

  const specFile = getInput('spec_file');
  const targetSpecFile = `${rpmBuildTmp}/SPECS/${basename(specFile)}`;

  debug('Copying spec file...');
  await copyFile(specFile, targetSpecFile);

  debug('Copying sources...');
  const sources = getInput('sources').split('\n');
  await Promise.all(sources.map((src) => copyFile(src, `${rpmSourcesTmp}/${basename(src)}`)));

  await mkdir(outputRpmDir, { recursive: true });

  debug('Running rpmbuild...');
  const templateVariables = getInput('template_vars')?.trim()?.split('\n')?.map((line) => {
    const tuple = line.trim().split('=');

    return {
      name: tuple[0],
      value: tuple[1],
    };
  });

  debug(`Template Variables: ${JSON.stringify(templateVariables, undefined, 2)}`);

  const res = await exec('rpmbuild', [
    '-bb',
    ...(templateVariables?.flatMap<string>((v) => ['-D', `${v.name} ${v.value}`]) || []),
    targetSpecFile,
  ]);

  if (res !== 0) {
    throw new Error('rpmbuild failed');
  }

  const builtRPMFilePath = (await findFilesByExt(targetRpmBuildTmp, 'rpm'))[0];

  await exec('rpmsign', [
    '--define',
    `_gpg_name ${getInput('gpg_key')}`,
    '--define',
    `__gpg_sign_cmd %{__gpg} gpg --no-armor --batch --pinentry-mode loopback --no-tty --yes --passphrase ${getInput('gpg_passphrase')} -u "%{_gpg_name}" -sbo %{__signature_filename} %{__plaintext_filename}`,
    '--resign',
    builtRPMFilePath,
  ]);

  debug('Copying to output dir...');
  const filename = basename(builtRPMFilePath).replace('.gz__', '.gz');
  await copyFile(builtRPMFilePath, `${outputRpmDir}/${filename}`);

  setOutput('rpm_package_name', filename);
  setOutput('rpm_package_path', `RPMS/${filename}`);
};

(async () => {
  const privateKeyPassphrase = getInput('gpg_passphrase');

  await importPrivateKey();
  if (privateKeyPassphrase) {
    await configureGPGAgent();
  }

  await buildPackage();

  debug('Done');
})();
