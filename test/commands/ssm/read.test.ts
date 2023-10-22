import { expect } from '@oclif/test';
import sinon, { SinonStubbedInstance } from 'sinon';

import SSMRead from '../../../src/commands/ssm/read';
import { SSMStore } from '../../../src/store';
import { ConfigFile } from '../../../src/config';
import { randomUUID } from 'crypto';

import test from '../../helpers/register';

describe('ssm:read', () => {
  const readTest = test
    .add('untrackedId', () => randomUUID())
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMRead.ssmStore = ctx.ssmStore)
    .finally(() => SSMRead.ssmStore = undefined);

  const readTestWithConfigFile = readTest
    .add('idWithVersion', () => randomUUID())
    .add('version', '777')
    .add('idWithoutVersion', () => randomUUID())
    .do((ctx) => SSMRead.configFile = ctx.configFile)
    .finally(() => SSMRead.configFile = undefined);


  readTestWithConfigFile
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves({
      name: ctx.idWithVersion,
      value: randomUUID(),
      version: ctx.version,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .do((ctx) => ctx.sandbox.stub(ConfigFile, 'doesExist').resolves(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      version: ctx.version,
    }))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.idWithVersion])
    .it('should use the version in the config file', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.getParamRecord);
      sinon.assert.calledWith(ctx.ssmStore.getParamRecord, ctx.idWithVersion, ctx.version);
    });

  readTestWithConfigFile
    .do((ctx) => ctx.sandbox.stub(ConfigFile, 'doesExist').resolves(false))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.idWithoutVersion])
    .exit(1)
    .it('should print an error and return an error code if the config file does not exist', (ctx) => {
      expect(ctx.stderr).to.contain('Config file could not be found.');
    });

  readTestWithConfigFile
    .do((ctx) => ctx.sandbox.stub(ConfigFile, 'doesExist').resolves(true))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId])
    .exit(1)
    .it('should print an error and return an error code if the parameter is not tracked in the config file', (ctx) => {
      expect(ctx.stderr).to.contain('Parameter config not found');
    });

  readTestWithConfigFile
    .add('latestVersion', '7777')
    .do((ctx) => ctx.sandbox.stub(ConfigFile, 'doesExist').resolves(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({}))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves({
      name: ctx.idWithoutVersion,
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.idWithoutVersion])
    .it('should use the latest version if the parameter is tracked, but is not locked to a specific version', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.getParamRecord);
      sinon.assert.calledWith(ctx.ssmStore.getParamRecord, ctx.idWithoutVersion, ctx.latestVersion);
    });

  readTest
    .add('latestVersion', '8888')
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves({
      name: ctx.untrackedId,
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId, '--latest'])
    .it('should use the latest version', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.getCurrentVersion);
      sinon.assert.calledWith(ctx.ssmStore.getParamRecord, ctx.untrackedId, ctx.latestVersion);
    });

  readTest
    .command(['ssm:read', '--name', 'unknown', '--version', '5', '--latest'])
    .exit(1)
    .it('should print an error and return an error code if latest and version flags are specified together', (ctx) => {
      expect(ctx.stderr).to.contain('--latest').and.contain('--version');
    });

  readTest
    .command('ssm:read')
    .exit(1)
    .it('should require the name flag', (ctx) => {
      expect(ctx.stderr).to.contain('Missing required flag name');
    });

  readTest
    .add('latestVersion', '8888')
    .add('paramRecord', (ctx) => ({
      name: ctx.untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves(ctx.paramRecord))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId, '--latest', '--no-truncate'])
    .it('should print the result in a table without the description', (ctx) => {
      expect(ctx.stdout)
        .to.contain(ctx.untrackedId)
        .and.to.contain(ctx.paramRecord.value)
        .and.to.contain(ctx.paramRecord.version)
        .and.to.contain(ctx.paramRecord.modifiedAt.toISOString())
        .and.to.contain(ctx.paramRecord.modifiedBy)
        .and.not.to.contain(ctx.paramRecord.description);
    });

  readTest
    .add('latestVersion', '8888')
    .add('paramRecord', (ctx) => ({
      name: ctx.untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves(ctx.paramRecord))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId, '--latest', '--no-truncate', '-x'])
    .it('should include the description if the extended flag is specified', (ctx) => {
      expect(ctx.stdout).to.contain(ctx.paramRecord.description);
    });

  readTest
    .add('latestVersion', '8888')
    .add('paramRecord', (ctx) => ({
      name: ctx.untrackedId,
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves(ctx.paramRecord))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId, '--latest', '--quiet'])
    .it('should only print the version if the quiet flag is specified', (ctx) => {
      expect(ctx.stdout).to.equal(`${ctx.paramRecord.value}\n`);
    });

  readTest
    .add('latestVersion', '8888')
    .add('paramRecord', (ctx) => ({
      name: ctx.untrackedId,
      description: 'A long description.',
      value: randomUUID(),
      version: ctx.latestVersion,
      modifiedAt: new Date(),
      modifiedBy: 'me',
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').resolves(ctx.latestVersion))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamRecord').resolves(ctx.paramRecord))
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.untrackedId, '--latest', '--output', 'json', '-x'])
    .it('should print the result in JSON if the output format is specified as JSON', (ctx) => {
      expect(ctx.stdout).to.equal(`${JSON.stringify([ctx.paramRecord], undefined, 2)}\n`);
    });
})
