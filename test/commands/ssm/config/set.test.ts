import { expect } from '@oclif/test'
import { randomUUID } from 'crypto';
import Sinon, { SinonStubbedInstance } from 'sinon';

import test from '../../../helpers/register';
import SSMConfigSet from '../../../../src/commands/ssm/config/set';
import { ParamConfig, Source } from '../../../../src/config';
import { SSMStore } from '../../../../src/store';

describe('config:set', () => {
  const setConfigTest = test
    .add('name', () => `/griffin/test/${randomUUID()}`)
    .add('paramConfig', (): ParamConfig => ({
      version: '5',
      envVarName: 'TEST',
      allowMissingValue: false,
    }))
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMConfigSet.ssmStore = ctx.ssmStore)
    .finally(() => SSMConfigSet.ssmStore = undefined)
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').withArgs(Source.SSM, ctx.name).callsFake(() => ctx.paramConfig))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => SSMConfigSet.configFile = ctx.configFile)
    .finally(() => SSMConfigSet.configFile = undefined)
    .finally((ctx) => Sinon.assert.called(ctx.configFile.save));

  setConfigTest
    .add('updatedEnvVarName', (ctx) => `${ctx.name}_UPDATED`)
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--env-var-name', ctx.updatedEnvVarName])
    .it('should update the environment variable name', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('envVarName', ctx.updatedEnvVarName));
    });

  setConfigTest
    .do((ctx) => ctx.paramConfig.allowMissingValue = false)
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--allow-missing-value'])
    .it('should set allow missing value to true if --allow-missing-value is specified', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('allowMissingValue', true));
    });

  setConfigTest
    .do((ctx) => ctx.paramConfig.allowMissingValue = true)
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--no-allow-missing-value'])
    .it('should set allow missing value to false if --no-allow-missing-value is specified', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('allowMissingValue', false));
    });

  setConfigTest
    .add('updatedVersion', (ctx) => `${parseInt(ctx.paramConfig.version ?? '0', 10) + 99}`)
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--use-version', ctx.updatedVersion])
    .it('should lock the version if --use-version is specified', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('version', ctx.updatedVersion));
    });

  setConfigTest
    .do((ctx) => ctx.paramConfig.version = '5')
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--always-use-latest'])
    .it('should unset the version if --always-use-latest is set', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('version', undefined));
    });

  setConfigTest
    .add('latestVersion', (ctx) => `${parseInt(ctx.paramConfig.version ?? '5', 10) + 2}`)
    .do((ctx) => delete ctx.paramConfig.version)
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').withArgs(ctx.name).resolves(ctx.latestVersion))
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--no-always-use-latest'])
    .it('should use the latest version if --no-always-use-latest is specified and no version is set', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('version', ctx.latestVersion));
    });

  setConfigTest
    .add('latestVersion', (ctx) => `${parseInt(ctx.paramConfig.version ?? '5', 10) + 2}`)
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getCurrentVersion').withArgs(ctx.name).resolves(ctx.latestVersion))
    .commandWithContext((ctx) => ['ssm:config:set', '--name', ctx.name, '--no-always-use-latest'])
    .it('should not change the version if --no-always-use-latest is specified and a no version is already set', (ctx) => {
      Sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, Sinon.match.has('version', ctx.paramConfig.version));
    });
})
