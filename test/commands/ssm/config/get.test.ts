import { expect } from 'chai';
import sinon, { SinonSandbox, SinonStubbedInstance } from 'sinon';
import { runCommand } from '@oclif/test';
import { randomUUID } from 'crypto';

import SSMConfigGet from '../../../../src/commands/ssm/config/get.js';
import { ConfigFile, ParamConfig, Source } from '../../../../src/config/index.js';

describe('config:get', () => {
  let sandbox: SinonSandbox;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let name: string;
  let paramConfig: ParamConfig;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    configFile = new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>;
    name = `/griffin/test/${randomUUID()}`;
    paramConfig = {
      version: '7',
      envVarName: 'TEST',
      allowMissingValue: true,
    };
    sandbox.stub(configFile, 'getParamConfig').callsFake((source, paramName) => {
      if (source === Source.SSM && paramName === name) {
        return paramConfig;
      }
      return undefined;
    });
    SSMConfigGet.configFile = configFile;
  });

  afterEach(() => {
    SSMConfigGet.configFile = undefined;
    sandbox.restore();
  });

  it('should print an error if parameter does not exist in griffin', async () => {
    const unknownName = randomUUID();

    const { error, stderr } = await runCommand(['ssm:config:get', '--name', unknownName, '--all']);

    expect(error?.oclif?.exit).to.equal(1);
    expect(stderr).to.contain(`Parameter config not found: ${unknownName}`);
  });

  it('should print the whole config if --all is specified', async () => {
    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--all']);

    expect(stdout.trim()).to.equal(JSON.stringify(paramConfig, undefined, 2));
  });

  it('should print the environment variable name', async () => {
    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'envVarName']);

    expect(stdout.trim()).to.equal(paramConfig.envVarName);
  });

  it('should print "not set" if the environment name is not set', async () => {
    paramConfig.envVarName = undefined;

    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'envVarName']);

    expect(stdout.trim()).to.equal('not set');
  });

  it('should print the version', async () => {
    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'version']);

    expect(stdout.trim()).to.equal(paramConfig.version);
  });

  it('should print "latest" if the version is not locked', async () => {
    paramConfig.version = undefined;

    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'version']);

    expect(stdout.trim()).to.equal('latest');
  });

  it('should print true if the parameter is allowed to be missing', async () => {
    paramConfig.allowMissingValue = true;

    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'allowMissingValue']);

    expect(stdout.trim()).to.equal('true');
  });

  it('should print false if the parameter is not allowed to be missing', async () => {
    paramConfig.allowMissingValue = false;

    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'allowMissingValue']);

    expect(stdout.trim()).to.equal('false');
  });

  it('should print false if allowMissingValue is not set at all', async () => {
    paramConfig.allowMissingValue = undefined;

    const { stdout } = await runCommand(['ssm:config:get', '--name', name, '--config-name', 'allowMissingValue']);

    expect(stdout.trim()).to.equal('false');
  });
});
