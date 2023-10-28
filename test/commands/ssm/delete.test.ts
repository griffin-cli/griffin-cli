import test from '../../helpers/register';
import SSMDelete from '../../../src/commands/ssm/delete';
import { SSMStore } from '../../../src/store';
import { randomUUID } from 'crypto';
import sinon, { SinonStubbedInstance } from 'sinon';
import { Source } from '../../../src/config';

describe('ssm:delete', () => {
  const deleteTest = test
    .do((ctx) => SSMDelete.configFile = ctx.configFile)
    .finally(() => SSMDelete.configFile = undefined)
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMDelete.ssmStore = ctx.ssmStore)
    .finally(() => SSMDelete.ssmStore = undefined)
    .add('name', () => randomUUID())
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'delete').resolves())

  deleteTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'removeParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:delete', '--name', ctx.name])
    .it('should delete the parameter and remove it from the config file', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.delete);
      sinon.assert.calledWith(ctx.ssmStore.delete, ctx.name);

      sinon.assert.calledOnce(ctx.configFile.removeParamConfig);
      sinon.assert.calledWith(ctx.configFile.removeParamConfig, Source.SSM, ctx.name);
    });

  deleteTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(false))
    .commandWithContext((ctx) => ['ssm:delete', '--name', ctx.name])
    .it('should delete the parameter even if the parameter is not tracked', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.delete);
      sinon.assert.calledWith(ctx.ssmStore.delete, ctx.name);
    })
})
