import { expect } from '@oclif/test'

import test from '../../../helpers/register';
import { randomUUID } from 'crypto';
import SSMConfigGet from '../../../../src/commands/ssm/config/get';
import { ParamConfig, Source } from '../../../../src/config';

describe('config:get', () => {
  const getConfigTest = test
    .add('name', () => `/griffin/test/${randomUUID()}`)
    .add('paramConfig', (): ParamConfig => ({
      version: '7',
      envVarName: 'TEST',
      allowMissingValue: true,
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').withArgs(Source.SSM, ctx.name).callsFake(() => ctx.paramConfig))
    .do((ctx) => SSMConfigGet.configFile = ctx.configFile)
    .finally(() => SSMConfigGet.configFile = undefined);

  getConfigTest
    .add('unknownName', randomUUID())
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.unknownName, '--all'])
    .exit(1)
    .it('should print an error if parameter does not exist in griffin', async (ctx) => {
      expect(ctx.stderr).to.contain(`Parameter config not found: ${ctx.unknownName}`);
    });

  getConfigTest
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--all'])
    .it('should print the whole config if --all is specified', async (ctx) => {
      expect(ctx.stdout.trim()).to.equal(JSON.stringify(ctx.paramConfig, undefined, 2));
    });

  getConfigTest
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'envVarName'])
    .it('should print the environment variable name', (ctx) => {
      expect(ctx.stdout.trim()).to.equal(ctx.paramConfig.envVarName);
    });

  getConfigTest
    .do((ctx) => ctx.paramConfig.envVarName = undefined)
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'envVarName'])
    .it('should print "not set" if the environment name is not set', (ctx) => {
      expect(ctx.stdout.trim()).to.equal('not set');
    });

  getConfigTest
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'version'])
    .it('should print the version', (ctx) => {
      expect(ctx.stdout.trim()).to.equal(ctx.paramConfig.version);
    });

  getConfigTest
    .do((ctx) => ctx.paramConfig.version = undefined)
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'version'])
    .it('should print "latest" if the version is not locked', (ctx) => {
      expect(ctx.stdout.trim()).to.equal('latest');
    });

  getConfigTest
    .do((ctx) => ctx.paramConfig.allowMissingValue = true)
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'allowMissingValue'])
    .it('should print true if the parameter is allowed to be missing', (ctx) => {
      expect(ctx.stdout.trim()).to.equal('true');
    });

  getConfigTest
    .do((ctx) => ctx.paramConfig.allowMissingValue = false)
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'allowMissingValue'])
    .it('should print false if the parameter is not allowed to be missing', (ctx) => {
      expect(ctx.stdout.trim()).to.equal('false');
    });

  getConfigTest
    .do((ctx) => ctx.paramConfig.allowMissingValue = undefined)
    .commandWithContext((ctx) => ['ssm:config:get', '--name', ctx.name, '--config-name', 'allowMissingValue'])
    .it('should print false if allowMissingValue is not set at all', (ctx) => {
      expect(ctx.stdout.trim()).to.equal('false');
    });
})
