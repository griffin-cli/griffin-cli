import { Source } from '../../../src/config/index.js'
import sinon from 'sinon'
import SSMRemove from '../../../src/commands/ssm/remove.js'
import { randomUUID } from 'crypto'
import test from '../../helpers/register.js'

describe('ssm:remove', () => {
  const removeTest = test
    .do((ctx) => SSMRemove.configFile = ctx.configFile)
    .finally(() => SSMRemove.configFile = undefined)
    .add('name', () => randomUUID());

  removeTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'removeParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:remove', '--name', ctx.name])
    .it('should remove the config and save the updated config to file', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.removeParamConfig);
      sinon.assert.calledWith(ctx.configFile.removeParamConfig, Source.SSM, ctx.name);

      sinon.assert.calledOnce(ctx.configFile.save);
    });
});
