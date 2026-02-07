import { expect } from 'chai';
import sinon, { SinonSandbox, SinonStubbedInstance } from 'sinon';
import { runCommand } from '@oclif/test';
import { randomUUID } from 'crypto';

import SSMConfigSet from '../../../../src/commands/ssm/config/set.js';
import { ConfigFile, ParamConfig, Source } from '../../../../src/config/index.js';
import { SSMStore } from '../../../../src/store/index.js';

describe('config:set', () => {
  let sandbox: SinonSandbox;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let name: string;
  let paramConfig: ParamConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    configFile = new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>;
    ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
    name = `/griffin/test/${randomUUID()}`;
    paramConfig = {
      version: '5',
      envVarName: 'TEST',
      allowMissingValue: false,
    };

    sandbox.stub(configFile, 'getParamConfig').callsFake((source, paramName) => {
      if (source === Source.SSM && paramName === name) {
        return paramConfig;
      }
      return undefined;
    });
    sandbox.stub(configFile, 'save').resolves();
    sandbox.stub(configFile, 'setParamConfig').returns();

    SSMConfigSet.ssmStore = ssmStore;
    SSMConfigSet.configFile = configFile;
  });

  afterEach(() => {
    SSMConfigSet.ssmStore = undefined;
    SSMConfigSet.configFile = undefined;
    sandbox.restore();
  });

  it('should update the environment variable name', async () => {
    const updatedEnvVarName = `${name}_UPDATED`;

    await runCommand(['ssm:config:set', '--name', name, '--env-var-name', updatedEnvVarName]);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('envVarName', updatedEnvVarName));
    sinon.assert.called(configFile.save);
  });

  it('should set allow missing value to true if --optional is specified', async () => {
    paramConfig.allowMissingValue = false;

    await runCommand(['ssm:config:set', '--name', name, '--optional']);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('allowMissingValue', true));
    sinon.assert.called(configFile.save);
  });

  it('should set allow missing value to false if --no-optional is specified', async () => {
    paramConfig.allowMissingValue = true;

    await runCommand(['ssm:config:set', '--name', name, '--no-optional']);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('allowMissingValue', false));
    sinon.assert.called(configFile.save);
  });

  it('should lock the version if --version is specified', async () => {
    const updatedVersion = `${parseInt(paramConfig.version ?? '0', 10) + 99}`;

    await runCommand(['ssm:config:set', '--name', name, '--version', updatedVersion]);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('version', updatedVersion));
    sinon.assert.called(configFile.save);
  });

  it('should unset the version if --always-use-latest is set', async () => {
    paramConfig.version = '5';

    await runCommand(['ssm:config:set', '--name', name, '--always-use-latest']);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('version', undefined));
    sinon.assert.called(configFile.save);
  });

  it('should use the latest version if --no-always-use-latest is specified and no version is set', async () => {
    const latestVersion = `${parseInt(paramConfig.version ?? '5', 10) + 2}`;
    delete paramConfig.version;
    sandbox.stub(ssmStore, 'getCurrentVersion').withArgs(name).resolves(latestVersion);

    await runCommand(['ssm:config:set', '--name', name, '--no-always-use-latest']);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('version', latestVersion));
    sinon.assert.called(configFile.save);
  });

  it('should not change the version if --no-always-use-latest is specified and a version is already set', async () => {
    const latestVersion = `${parseInt(paramConfig.version ?? '5', 10) + 2}`;
    sandbox.stub(ssmStore, 'getCurrentVersion').withArgs(name).resolves(latestVersion);

    await runCommand(['ssm:config:set', '--name', name, '--no-always-use-latest']);

    sinon.assert.calledWith(configFile.setParamConfig, Source.SSM, name, sinon.match.has('version', paramConfig.version));
    sinon.assert.called(configFile.save);
  });
});
