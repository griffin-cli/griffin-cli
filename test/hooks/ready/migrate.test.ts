import { expect } from 'chai';
import { Interfaces } from '@oclif/core';
import mock from 'mock-fs';
import sinon, { SinonSandbox, SinonStub } from 'sinon';

import migrate from '../../../src/hooks/ready/migrate.js';
import { ConfigFile } from '../../../src/config/index.js';

describe('Migrate Hook', () => {
  let sandbox: SinonSandbox;
  let hookContext: sinon.SinonStubbedInstance<Interfaces.Hook.Context>;
  let migrateConfigStub: SinonStub;
  let opts: {
    Command: any;
    argv: string[];
    config: any;
    configFile: any;
    flags: any;
    args: any;
    context: any;
    ux: {
      confirm: SinonStub;
    };
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    hookContext = {
      config: {} as any,
      debug: sandbox.stub().returns(undefined),
      error: sandbox.stub().returns(undefined),
      exit: sandbox.stub().returns(undefined),
      log: sandbox.stub().returns(undefined),
      warn: sandbox.stub().returns(undefined),
    } as sinon.SinonStubbedInstance<Interfaces.Hook.Context>;

    migrateConfigStub = sandbox.stub(ConfigFile, 'migrateConfig');

    opts = {
      Command: class {},
      argv: [],
      config: {} as any,
      configFile: {} as any,
      flags: {} as any,
      args: {},
      context: {} as any,
      ux: {
        confirm: sandbox.stub(),
      },
    };
  });

  afterEach(() => {
    mock.restore();
    sandbox.restore();
  });

  async function runMigrate(answer?: boolean): Promise<void> {
    if (answer !== undefined && answer !== null) {
      opts.ux.confirm.resolves(answer);
    }
    await migrate.call(hookContext, opts);
  }

  it('should not prompt the user to migrate if no config files exist', async () => {
    mock({});

    await runMigrate();

    sinon.assert.notCalled(hookContext.warn);
    sinon.assert.notCalled(opts.ux.confirm);
    sinon.assert.notCalled(migrateConfigStub);
  });

  it('should not prompt the user to migrate if only new config files exist', async () => {
    mock({
      '.griffin-config.prod.yaml': '{}',
      '.griffin-config.staging.yaml': '{}',
      '.griffin-config.dev.yaml': '{}',
    });

    await runMigrate();

    sinon.assert.notCalled(hookContext.warn);
    sinon.assert.notCalled(opts.ux.confirm);
    sinon.assert.notCalled(migrateConfigStub);
  });

  it('should prompt the user and not migrate the legacy config files if the user declines', async () => {
    mock({
      '.griffin-config.prod.json': '{}',
      '.griffin-config.staging.json': '{}',
      '.griffin-config.dev.json': '{}',
    });

    await runMigrate(false);

    sinon.assert.calledOnce(hookContext.warn);
    sinon.assert.calledOnce(opts.ux.confirm);
    sinon.assert.notCalled(migrateConfigStub);
  });

  it('should migrate all of the legacy config files if the user accepts', async () => {
    mock({
      '.griffin-config.prod.json': '{}',
      '.griffin-config.staging.json': '{}',
      '.griffin-config.dev.json': '{}',
    });

    await runMigrate(true);

    sinon.assert.calledOnce(hookContext.warn);
    sinon.assert.calledOnce(opts.ux.confirm);

    sinon.assert.calledThrice(migrateConfigStub);
    sinon.assert.calledWith(migrateConfigStub, 'prod', undefined);
    sinon.assert.calledWith(migrateConfigStub, 'staging', undefined);
    sinon.assert.calledWith(migrateConfigStub, 'dev', undefined);
  });

  it('should only check the directory specified by the cwd flag', async () => {
    mock({
      '.griffin-config.prod.json': '{}',
      './test/.griffin-config.prod.yaml': '{}',
    });
    opts.flags.cwd = './test';

    await migrate.call(hookContext, opts);

    sinon.assert.notCalled(hookContext.warn);
    sinon.assert.notCalled(opts.ux.confirm);
    sinon.assert.notCalled(migrateConfigStub);
  });

  it('should detect files in the directory specified by the cwd flag');

  it('should log a warning if there is an error migrating a file', async () => {
    mock({
      '.griffin-config.prod.json': '{}',
    });
    opts.ux.confirm.resolves(true);
    migrateConfigStub.rejects('uh-oh, an error');

    await migrate.call(hookContext, opts);

    sinon.assert.calledTwice(hookContext.warn);
    sinon.assert.calledWith(hookContext.warn, sinon.match('Could not convert ".griffin-config.prod.json": uh-oh, an error'));
  });
});
