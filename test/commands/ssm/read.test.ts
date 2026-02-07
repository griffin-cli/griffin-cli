import { expect } from 'chai';
import sinon, { SinonSandbox, SinonStubbedInstance } from 'sinon';
import { runCommand } from '@oclif/test';
import { randomUUID } from 'crypto';

import SSMRead from '../../../src/commands/ssm/read.js';
import { SSMStore } from '../../../src/store/index.js';
import { ConfigFile } from '../../../src/config/index.js';

describe('ssm:read', () => {
  let sandbox: SinonSandbox;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let untrackedId: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
    configFile = new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>;
    untrackedId = randomUUID();
    SSMRead.ssmStore = ssmStore;
  });

  afterEach(() => {
    SSMRead.ssmStore = undefined;
    SSMRead.configFile = undefined;
    sandbox.restore();
  });

  describe('with config file', () => {
    beforeEach(() => {
      SSMRead.configFile = configFile;
    });

    it('should use the version in the config file', async () => {
      const idWithVersion = randomUUID();
      const version = '777';
      sandbox.stub(ssmStore, 'getParamRecord').resolves({
        name: idWithVersion,
        value: randomUUID(),
        version,
        modifiedAt: new Date(),
        modifiedBy: 'me',
      });
      sandbox.stub(ConfigFile, 'doesExist').resolves(true);
      sandbox.stub(configFile, 'getParamConfig').returns({ version });

      await runCommand(['ssm:read', '--name', idWithVersion]);

      sinon.assert.calledOnce(ssmStore.getParamRecord);
      sinon.assert.calledWith(ssmStore.getParamRecord, idWithVersion, version);
    });

    it('should print an error and return an error code if the config file does not exist', async () => {
      sandbox.stub(ConfigFile, 'doesExist').resolves(false);

      const { error, stderr } = await runCommand(['ssm:read', '--name', randomUUID()]);

      expect(error?.oclif?.exit).to.equal(1);
      expect(stderr).to.contain('Config file could not be found.');
    });

    it('should print an error and return an error code if the parameter is not tracked in the config file', async () => {
      sandbox.stub(ConfigFile, 'doesExist').resolves(true);
      sandbox.stub(configFile, 'getParamConfig').returns(undefined);

      const { error, stderr } = await runCommand(['ssm:read', '--name', untrackedId]);

      expect(error?.oclif?.exit).to.equal(1);
      expect(stderr).to.contain('Parameter config not found');
    });

    it('should use the latest version if the parameter is tracked, but is not locked to a specific version', async () => {
      const idWithoutVersion = randomUUID();
      const latestVersion = '7777';
      sandbox.stub(ConfigFile, 'doesExist').resolves(true);
      sandbox.stub(configFile, 'getParamConfig').returns({});
      sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
      sandbox.stub(ssmStore, 'getParamRecord').resolves({
        name: idWithoutVersion,
        value: randomUUID(),
        version: latestVersion,
        modifiedAt: new Date(),
        modifiedBy: 'me',
      });

      await runCommand(['ssm:read', '--name', idWithoutVersion]);

      sinon.assert.calledOnce(ssmStore.getParamRecord);
      sinon.assert.calledWith(ssmStore.getParamRecord, idWithoutVersion, latestVersion);
    });
  });

  it('should use the latest version', async () => {
    const latestVersion = '8888';
    sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
    sandbox.stub(ssmStore, 'getParamRecord').resolves({
      name: untrackedId,
      value: randomUUID(),
      version: latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    });

    await runCommand(['ssm:read', '--name', untrackedId, '--latest']);

    sinon.assert.calledOnce(ssmStore.getCurrentVersion);
    sinon.assert.calledWith(ssmStore.getParamRecord, untrackedId, latestVersion);
  });

  it('should print an error and return an error code if latest and version flags are specified together', async () => {
    const { error, stderr } = await runCommand(['ssm:read', '--name', 'unknown', '--version', '5', '--latest']);

    expect(error?.oclif?.exit).to.equal(1);
    expect(stderr).to.contain('--latest').and.contain('--version');
  });

  it('should require the name flag', async () => {
    const { error, stderr } = await runCommand(['ssm:read']);

    expect(error?.oclif?.exit).to.equal(1);
    expect(stderr).to.contain('Missing required flag name');
  });

  it('should print the result in a table without the description', async () => {
    const latestVersion = '8888';
    const paramRecord = {
      name: untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    };
    sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
    sandbox.stub(ssmStore, 'getParamRecord').resolves(paramRecord);

    const { stdout } = await runCommand(['ssm:read', '--name', untrackedId, '--latest', '--no-truncate']);

    expect(stdout)
      .to.contain(untrackedId)
      .and.to.contain(paramRecord.value)
      .and.to.contain(paramRecord.version)
      .and.to.contain(paramRecord.modifiedAt.toISOString())
      .and.to.contain(paramRecord.modifiedBy)
      .and.not.to.contain(paramRecord.description);
  });

  it('should include the description if the extended flag is specified', async () => {
    const latestVersion = '8888';
    const paramRecord = {
      name: untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    };
    sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
    sandbox.stub(ssmStore, 'getParamRecord').resolves(paramRecord);

    const { stdout } = await runCommand(['ssm:read', '--name', untrackedId, '--latest', '--no-truncate', '-x']);

    expect(stdout).to.contain(paramRecord.description);
  });

  it('should only print the value if the quiet flag is specified', async () => {
    const latestVersion = '8888';
    const paramRecord = {
      name: untrackedId,
      value: randomUUID(),
      version: latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    };
    sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
    sandbox.stub(ssmStore, 'getParamRecord').resolves(paramRecord);

    const { stdout } = await runCommand(['ssm:read', '--name', untrackedId, '--latest', '--quiet']);

    expect(stdout).to.equal(`${paramRecord.value}\n`);
  });

  it('should print the result in JSON if the output format is specified as JSON', async () => {
    const latestVersion = '8888';
    const paramRecord = {
      name: untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    };
    sandbox.stub(ssmStore, 'getCurrentVersion').resolves(latestVersion);
    sandbox.stub(ssmStore, 'getParamRecord').resolves(paramRecord);

    const { stdout } = await runCommand(['ssm:read', '--name', untrackedId, '--latest', '--output', 'json', '-x']);

    expect(stdout).to.equal(`${JSON.stringify([paramRecord], undefined, 2)}\n`);
  });
});
