import { expect } from '@oclif/test';
import Sinon, { SinonStub, SinonStubbedInstance } from 'sinon';

import test from '../../helpers/register';
import { SSMStore } from '../../../src/store';
import SSMHistory from '../../../src/commands/ssm/history';
import { randomUUID } from 'crypto';
import { DataLogger } from '../../../src/utils';

describe('ssm:history', () => {
  const historyTest = test
    .add('name', () => `/griffin/test/${randomUUID()}`)
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMHistory.ssmStore = ctx.ssmStore)
    .finally(() => SSMHistory.ssmStore = undefined)
    .add('historyRecords', (ctx) => [{
      name: ctx.name,
      value: randomUUID(),
      version: '1',
      modifiedAt: new Date(),
      modifiedBy: 'griffin',
    }])
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getHistory').withArgs(ctx.name).resolves(ctx.historyRecords))
    .do((ctx) => ctx.sandbox.stub(DataLogger, 'log').returns());

  historyTest
    .commandWithContext((ctx) => ['ssm:history', '--name', ctx.name, '--extended'])
    .it('should log the history records', (ctx) => {
      Sinon.assert.calledOnce(ctx.ssmStore.getHistory);
      Sinon.assert.calledOnce(DataLogger.log as SinonStub);
      Sinon.assert.calledWith(DataLogger.log as SinonStub, Sinon.match({
        name: {},
        description: {
          extended: true,
        },
        value: {},
        version: {},
        modifiedAt: {},
        modifiedBy: {},
      }), ctx.historyRecords, Sinon.match.has('extended', true));
    })
});
