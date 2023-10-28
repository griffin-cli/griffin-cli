import { expect } from '@oclif/test'
import { stdin } from 'mock-stdin';
import sinon from 'sinon';

import SSMWrite from '../../../src/commands/ssm/write';
import test from '../../helpers/register';
import { SSMStore } from '../../../src/store';
import { Source } from '../../../src/config';
import { randomUUID } from 'crypto';
import { SinonStubbedInstance, SinonStub } from 'sinon';
import { ux } from '@oclif/core';
import { ParameterType } from '@aws-sdk/client-ssm';

describe('ssm:write', () => {
  const writeTest = test
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMWrite.ssmStore = ctx.ssmStore)
    .finally(() => SSMWrite.ssmStore = undefined)
    .do((ctx) => SSMWrite.configFile = ctx.configFile)
    .finally(() => SSMWrite.configFile = undefined)
    .add('name', () => randomUUID())
    .add('value', () => randomUUID())
    .add('envVarName', () => randomUUID().replaceAll('-', '_'))
    .add('originalVersion', '6')
    .add('updatedVersion', '7');

  const happyPathWriteTest = writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(false))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves());

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--type', 'SecureString'])
    .it('should use the value specified with the --value flag', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathWriteTest
    .commandWithStdin((ctx) => ({
      argv: ['ssm:write', '--name', ctx.name, '--from-stdin', '--type', 'SecureString'],
      input: ctx.value,
    }))
    .it('should use the value from stdin if --from-stdin is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathWriteTest
    .add('value', () => `${randomUUID()}\n${randomUUID()}\n${randomUUID()}`)
    .commandWithStdin((ctx) => ({
      argv: ['ssm:write', '--name', ctx.name, '--from-stdin', '--type', 'SecureString'],
      input: ctx.value.split('\n'),
    }))
    .it('should read multiple lines from stdin', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathWriteTest
    .add('input', (ctx) => `${ctx.value}\n${randomUUID()}\n${randomUUID()}`)
    .commandWithStdin((ctx) => ({
      argv: ['ssm:write', '--name', ctx.name, '--from-stdin', '--type', 'SecureString', '--read-single-line'],
      input: ctx.input.split('\n'),
    }))
    .it('should only read the first line from stdin if --from-stdin and --read-single-line is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathWriteTest
    .do((ctx) => ctx.sandbox.stub(ux, 'prompt').resolves(ctx.value))
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--type', 'SecureString'])
    .it('should prompt the user for the value', (ctx) => {
      sinon.assert.calledOnce(ux.prompt as SinonStub);
      sinon.assert.calledWith(ux.prompt as SinonStub, 'Value', sinon.match.has('type', 'mask'));

      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathWriteTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamValue').resolves(ctx.value))
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--type', 'SecureString', '--skip-unchanged'])
    .it('should not update the parameter if the value has not changed', (ctx) => {
      sinon.assert.notCalled(ctx.ssmStore.writeParam);
    });

  happyPathWriteTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamValue').resolves(`${ctx.value}_old`))
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--type', 'SecureString', '--skip-unchanged'])
    .it('should update the parameter if the value has changed and skip unchanged is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
    });

  happyPathWriteTest
    .add('description', `${randomUUID} ${randomUUID}`)
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--type', 'SecureString', '--description', ctx.description])
    .it('should save the description if provided', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('description', ctx.description));
    });

  happyPathWriteTest
    .add('paramType', 'String')
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--type', ctx.paramType])
    .it('should use the parameter type specified with --type', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('type', ctx.paramType));
    });

  happyPathWriteTest
    .add('paramType', 'String')
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should default the type to SecureString if --type is not specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('type', ParameterType.SECURE_STRING));
    });

  writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should not specify the type if the parameter is already in config', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('type', undefined));
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--value', ctx.value, '--type', ParameterType.SECURE_STRING])
    .exit(1)
    .it('should require the --name flag', (ctx) => {
      expect(ctx.stderr).to.contain('name').and.contain('required');
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--env-var-name', ctx.envVarName])
    .it('should use the env var name specified with the --env-var-name flag', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('envVarName', ctx.envVarName));
    });

  writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      envVarName: ctx.envVarName,
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should not overwrite an existing env var name if the --env-var-name flag is not provided', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('envVarName', ctx.envVarName));
    });

  writeTest
    .add('updatedEnvVarName', () => randomUUID().replaceAll('-', '_'))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      envVarName: ctx.envVarName,
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--env-var-name', ctx.updatedEnvVarName])
    .it('should overwrite an existing env var name if the --env-var-name flag is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('envVarName', ctx.updatedEnvVarName));
    });

  happyPathWriteTest
    .add('name', '/test/this-is-a-name')
    .add('expectedEnvVarName', 'THIS_IS_A_NAME')
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should default to the name of the parameter (without the prefix) for new parameters', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('envVarName', ctx.expectedEnvVarName));
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should save the current version to the config file', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('version', ctx.updatedVersion));
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--always-use-latest'])
    .it('should not lock the version in the config file if --always-use-latest is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('version', undefined));
    });

  writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      version: '5',
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--always-use-latest'])
    .it('should clear the version for an existing parameter if --always-use-latest is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('version', undefined));
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--allow-missing-value'])
    .it('should set allowMissingValue to true in the config if --allow-missing-value is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('allowMissingValue', true));
    });

  happyPathWriteTest
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should not set allowMissingValue in the config', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('allowMissingValue', undefined));
    });

  writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({}))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value, '--allow-missing-value'])
    .it('should set allowMissingValue to true for an existing parameter if --allow-missing-value is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('allowMissingValue', true));
    });

  writeTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      allowMissingValue: true,
    }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves())
    .commandWithContext((ctx) => ['ssm:write', '--name', ctx.name, '--value', ctx.value])
    .it('should use the existing value for allowMissingValue if the parameter already exists and --allow-missing-value is not set', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('allowMissingValue', true));
    });
})
