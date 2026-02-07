import { expect } from 'chai';
import sinon, { SinonSandbox, SinonStubbedInstance } from 'sinon';
import { runCommand } from '@oclif/test';
import { randomUUID } from 'crypto';

import SSMRemove from '../../../src/commands/ssm/remove.js';
import { ConfigFile, Source } from '../../../src/config/index.js';

describe('ssm:remove', () => {
  let sandbox: SinonSandbox;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let paramName: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    configFile = new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>;
    paramName = randomUUID();
    SSMRemove.configFile = configFile;
  });

  afterEach(() => {
    SSMRemove.configFile = undefined;
    sandbox.restore();
  });

  it('should remove the config and save the updated config to file', async () => {
    sandbox.stub(configFile, 'removeParamConfig').returns();
    sandbox.stub(configFile, 'save').resolves();

    await runCommand(['ssm:remove', '--name', paramName]);

    sinon.assert.calledOnce(configFile.removeParamConfig);
    sinon.assert.calledWith(configFile.removeParamConfig, Source.SSM, paramName);
    sinon.assert.calledOnce(configFile.save);
  });
});
