const { writeFile, readFile, chmod } = require('fs/promises');

const exec = require('./exec');
const { join } = require('path');
const rm = require('./rm');
const mkdirp = require('./mkdirp');
const pjson = require(`${process.cwd()}/package.json`);

function getDebArch(arch) {
  if (arch === 'x64') return 'amd64'
  if (arch === 'x86') return 'i386'
  if (arch === 'arm') return 'armel'
  if (arch === 'arm64') return 'arm64'
  throw new Error(`invalid arch: ${arch}`)
}

const getS3Bucket = () => `${process.env.DRY_RUN}` === 'true' ? pjson.oclif.update.s3.testBucket : pjson.oclif.update.s3.bucket;

/* This script is mostly pulled from the twilio-cli for generating Debian packages as the official
  oclif commands for generating Debian packages seem very limited.  With over a day's worth of work
  trying to work around the issues, this seems like the quicker approach. */

const binScript = () => `#!/usr/bin/env bash
set -e
echoerr() { echo "$@" 1>&2; }
get_script_dir () {
  SOURCE="\${BASH_SOURCE[0]}"
  # While \$SOURCE is a symlink, resolve it
  while [ -h "\$SOURCE" ]; do
    DIR="\$( cd -P "\$( dirname "\$SOURCE" )" && pwd )"
    SOURCE="\$( readlink "\$SOURCE" )"
    # If \$SOURCE was a relative symlink (so no "/" as prefix, need to resolve it relative to the symlink base directory
    [[ \$SOURCE != /* ]] && SOURCE="\$DIR/\$SOURCE"
  done
  DIR="\$( cd -P "\$( dirname "\$SOURCE" )" && pwd )"
  echo "\$DIR"
}
DIR=\$(get_script_dir)
export ${('UPDATE_INSTRUCTIONS')}="update with \\"sudo apt update && sudo apt install ${pjson.oclif.bin}\\""
\$DIR/node \$DIR/run "\$@"
`;

const controlScript = (arch, debVersion) => `Package: ${pjson.oclif.bin}
Version: ${debVersion}
Section: main
Priority: standard
Architecture: ${arch}
Maintainer: ${pjson.author}
Description: ${pjson.description}
`;

const ftparchiveScript = () => `
APT::FTPArchive::Release::Origin "${pjson.author}";
APT::FTPArchive::Release::Suite "stable";
}
`;

const scripts = {
  bin: binScript,
  control: controlScript,
  ftparchive: ftparchiveScript,
};

const copyRemotePackageFile = async (cwd) => {
  try {
    console.log('Copying remote Packages file...');

    await exec('aws', [
      's3',
      'cp',
      `s3://${getS3Bucket()}/apt/Packages`,
      'Packages'
    ], { cwd });

    console.log('Successfully copied remote Packages file...');
  } catch (err) {
    console.error(`Could not retrieve Package file: ${err}`);
    throw err;
  }
};

const verifyVersionDoesNotExist = async (distDir, version) => {
  const data = await readFile(`${distDir}/Packages`);

  if (data.includes(`Version: ${version}`)) {
    console.error(`Version is already available: ${version}`);
    throw new Error('version already exists');
  }
};

const packDebian = async (arches) => {
  const rootDir = process.cwd();
  const version = `${pjson.version}-1`;
  const config = {
    bin: pjson.oclif.bin,
    dirname: pjson.name,
  };

  const distDir = join(rootDir, 'dist', 'deb');

  const build = async (arch) => {
    console.log(`Building deb file for ${arch}...`);

    const debArch = getDebArch(arch);
    const filename = `${pjson.oclif.bin}_${version}_${debArch}`;
    const workspace = join(rootDir, 'tmp', 'apt', `${filename}.apt`);

    await rm(workspace);
    await mkdirp(workspace, 'DEBIAN');
    await mkdirp(workspace, 'usr', 'bin');
    await mkdirp(workspace, 'usr', 'lib');
    await mkdirp(distDir, debArch);

    await exec('cp', [
      '-r',
      join(rootDir, 'tmp', `linux-${arch}`, pjson.oclif.bin),
      join(workspace, 'usr', 'lib', pjson.name),
    ]);

    await writeFile(join(workspace, 'usr', 'lib', config.dirname, 'bin', config.bin), scripts.bin());
    await writeFile(join(workspace, 'DEBIAN', 'control'), scripts.control(debArch, version));

    await chmod(join(workspace, 'usr', 'lib', config.dirname, 'bin', config.bin), 0o755);

    await exec('ln', [
      '-s',
      `"../lib/${config.dirname}/bin/${config.bin}"`,
      `"${workspace}/usr/bin/${pjson.oclif.bin}"`,
    ]);

    console.log('Building package...');
    await exec('dpkg', [
      '--build',
      workspace,
      join(distDir, debArch, `${filename}.deb`),
    ]);
    console.log('Successfully built package.');

    console.log('Creating package file...');
    await exec('apt-ftparchive', [
      'packages',
      `${debArch}/`,
      '>>',
      'Packages',
    ], { cwd: distDir });
    console.log('Successfully created package file.');

    console.log(`Successfully built deb file for ${arch}.`);
  };

  await rm(distDir);
  await mkdirp(distDir);

  await copyRemotePackageFile(distDir);
  await verifyVersionDoesNotExist(distDir, version);

  await Promise.all(arches.map((arch) => build(arch)));

  await exec('gzip', [
    '-c',
    'Packages',
    '>',
    'Packages.gz',
  ], { cwd: distDir });

  await exec('bzip2', [
    '-k',
    'Packages',
  ], { cwd: distDir });

  await exec('xz', [
    '-k',
    'Packages',
  ], { cwd: distDir });

  console.log('Generating index files...');
  const ftparchive = join(rootDir, 'tmp', 'apt', 'apt-ftparchive.conf');
  await writeFile(ftparchive, scripts.ftparchive());
  await exec('apt-ftparchive', [
    '-c',
    ftparchive,
    'release',
    '.',
    '>',
    'Release',
  ], { cwd: distDir });
  console.log('Successfully generated index files.');

  console.log('Creating clear text signature...');
  await exec('gpg', [
    '--digest-algo',
    'SHA512',
    '--clearsign',
    '-u',
    process.env.GPG_KEY_ID,
    '--batch',
    '--pinentry-mode',
    'loopback',
    '--passphrase',
    `"${process.env.GPG_PASSPHRASE}"`,
    '-o',
    'InRelease',
    'Release',
  ], { cwd: distDir });
  console.log('Successfully created clear text signature.');

  console.log('Creating signature...');
  await exec('gpg', [
    '--digest-algo',
    'SHA512',
    '-abs',
    '-u',
    process.env.GPG_KEY_ID,
    '--batch',
    '--pinentry-mode',
    'loopback',
    '--passphrase',
    `"${process.env.GPG_PASSPHRASE}"`,
    '-o',
    'Release.gpg',
    'Release',
  ], { cwd: distDir });
  console.log('Successfully created signature.');

  console.log('Uploading deb files to S3...');
  await exec('aws', [
    's3',
    'cp',
    distDir,
    `s3://${getS3Bucket()}/apt`,
    '--recursive',
    '--acl',
    'public-read',
  ]);
  console.log('Successfully uploaded deb files to S3.');
};

const importGPGKey = async () => {
  console.log('Importing GPG key...');
  const keyFilePath = 'private.gpg';
  const privateKey = Buffer.from(process.env.GPG_PRIVATE_KEY, 'base64').toString('utf8');

  await writeFile(keyFilePath, privateKey);

  await exec('gpg', [
    '--import',
    '--batch',
    '--yes',
    keyFilePath,
  ]);

  console.log('Successfully imported GPG key.');
};

(async () => {
  if (process.platform != 'linux') {
    throw new Error('must be run from linux');
  }

  await importGPGKey();
  await packDebian(['x64', 'arm', 'arm64']);
})();
