import { ux as cliUx } from '@oclif/core';
import { Hook } from '@oclif/core/lib/interfaces';
import { test } from '@oclif/test'
import mock from 'mock-fs'
import { stdin } from 'mock-stdin';
import Sinon from 'sinon';

import migrate from '../../../src/hooks/ready/migrate.js';
import { ConfigFile } from '../../../src/config/index.js';

describe('Migrate Hook', () => {
  const migrateTest = test
    .stdout()
    .stderr()
    .add('hookContext', () => ({
      config: {} as any,
      debug: Sinon.stub().returns(undefined),
      error: Sinon.stub().returns(undefined),
      exit: Sinon.stub().returns(undefined),
      log: Sinon.stub().returns(undefined),
      warn: Sinon.stub().returns(undefined),
    } as Sinon.SinonStubbedInstance<Hook.Context>))
    .add('stdin', () => stdin())
    .finally((ctx) => ctx.stdin.restore())
    .add('sandbox', () => Sinon.createSandbox())
    .finally((ctx) => ctx.sandbox.restore())
    .add('migrateConfigStub', (ctx) => ctx.sandbox.stub(ConfigFile, 'migrateConfig'))
    .add('opts', (ctx) => ({
      Command: class { },
      argv: [],
      config: {} as any,
      configFile: {} as any,
      flags: {} as any,
      args: {},
      context: {} as any,
      ux: {
        confirm: Sinon.stub(),
      },
    }))
    .register('runMigrate', (answer?: boolean) => ({
      async run(ctx) {
        if (answer !== undefined && answer !== null) {
          (ctx.opts.ux.confirm).resolves(answer);
        }

        await migrate.call(ctx.hookContext, ctx.opts);
      },
    }))
    .finally(() => mock.restore());

  migrateTest
    .do(() => mock({}))
    .runMigrate()
    .it('should not prompt the user to migrate if no config files exist', async (ctx) => {
      Sinon.assert.notCalled(ctx.hookContext.warn);
      Sinon.assert.notCalled(ctx.opts.ux.confirm);
      Sinon.assert.notCalled(ctx.migrateConfigStub);
    });

  migrateTest
    .do(() => mock({
      '.griffin-config.prod.yaml': '{}',
      '.griffin-config.staging.yaml': '{}',
      '.griffin-config.dev.yaml': '{}',
    }))
    .runMigrate()
    .it('should not prompt the user to migrate if only new config files exist', async (ctx) => {
      Sinon.assert.notCalled(ctx.hookContext.warn);
      Sinon.assert.notCalled(ctx.opts.ux.confirm);
      Sinon.assert.notCalled(ctx.migrateConfigStub);
    });

  migrateTest
    .do(() => mock({
      '.griffin-config.prod.json': '{}',
      '.griffin-config.staging.json': '{}',
      '.griffin-config.dev.json': '{}',
    }))
    .runMigrate(false)
    .it('should prompt the user and not migrate the legacy config files if the user declines', async (ctx) => {
      Sinon.assert.calledOnce(ctx.hookContext.warn);
      Sinon.assert.calledOnce(ctx.opts.ux.confirm);
      Sinon.assert.notCalled(ctx.migrateConfigStub);
    });

  migrateTest
    .do(() => mock({
      '.griffin-config.prod.json': '{}',
      '.griffin-config.staging.json': '{}',
      '.griffin-config.dev.json': '{}',
    }))
    .runMigrate(true)
    .it('should migrate all of the legacy config files if the user accepts', async (ctx) => {
      Sinon.assert.calledOnce(ctx.hookContext.warn);
      Sinon.assert.calledOnce(ctx.opts.ux.confirm);

      Sinon.assert.calledThrice(ctx.migrateConfigStub);
      Sinon.assert.calledWith(ctx.migrateConfigStub, 'prod', undefined);
      Sinon.assert.calledWith(ctx.migrateConfigStub, 'staging', undefined);
      Sinon.assert.calledWith(ctx.migrateConfigStub, 'dev', undefined);
    });

  migrateTest
    .add('cwd', './test')
    .do((ctx) => mock({
      '.griffin-config.prod.json': '{}',
      './test/.griffin-config.prod.yaml': '{}',
    }))
    .do((ctx) => ctx.opts.flags.cwd = './test')
    .it('should only check the directory specified by the cwd flag', async (ctx) => {
      await migrate.call(ctx.hookContext, ctx.opts);

      Sinon.assert.notCalled(ctx.hookContext.warn);
      Sinon.assert.notCalled(ctx.opts.ux.confirm);
      Sinon.assert.notCalled(ctx.migrateConfigStub);
    });

  migrateTest
    .it('should detect files in the directory specified by the cwd flag');

  migrateTest
    .do(() => mock({
      '.griffin-config.prod.json': '{}',
    }))
    .it('should log a warning if there is an error migrating a file', async (ctx) => {
      ctx.opts.ux.confirm.resolves(true);
      ctx.migrateConfigStub.rejects('uh-oh, an error');

      await migrate.call(ctx.hookContext, ctx.opts);

      Sinon.assert.calledTwice(ctx.hookContext.warn);
      Sinon.assert.calledWith(ctx.hookContext.warn, Sinon.match('Could not convert ".griffin-config.prod.json": uh-oh, an error'));
    });
})
