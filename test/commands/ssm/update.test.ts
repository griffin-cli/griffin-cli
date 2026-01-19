import { expect } from '@oclif/test'
import { stdin } from 'mock-stdin';
import sinon from 'sinon';

import SSMUpdate from '../../../src/commands/ssm/update.js';
import test from '../../helpers/register.js';
import { SSMStore } from '../../../src/store/index.js';
import { Source } from '../../../src/config/index.js';
import { randomUUID } from 'crypto';
import { SinonStubbedInstance, SinonStub } from 'sinon';
import { ux } from '@oclif/core';
import { ParameterType } from '@aws-sdk/client-ssm';

describe('ssm:update', () => {
  const updateTest = test
    .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
    .do((ctx) => SSMUpdate.ssmStore = ctx.ssmStore)
    .finally(() => SSMUpdate.ssmStore = undefined)
    .do((ctx) => SSMUpdate.configFile = ctx.configFile)
    .finally(() => SSMUpdate.configFile = undefined)
    .add('name', () => randomUUID())
    .add('value', () => randomUUID())
    .add('envVarName', () => randomUUID().replaceAll('-', '_'))
    .add('originalVersion', '6')
    .add('updatedVersion', '7');

  const happyPathUpdateTest = updateTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(true))
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: ctx.updatedVersion }))
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns())
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'save').resolves());

  updateTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'hasParamConfig').returns(false))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value])
    .exit(1)
    .it('should throw an error if the param config does not exist', (ctx) => {
      expect(ctx.stderr).to.contain('Parameter config not found');
    });

  happyPathUpdateTest
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value])
    .it('should use the value specified with the --value flag', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathUpdateTest
    .commandWithStdin((ctx) => ({
      argv: ['ssm:update', '--name', ctx.name, '--from-stdin'],
      input: ctx.value,
    }))
    .it('should use the value from stdin if --from-stdin is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathUpdateTest
    .add('value', () => `${randomUUID()}\n${randomUUID()}\n${randomUUID()}`)
    .commandWithStdin((ctx) => ({
      argv: ['ssm:update', '--name', ctx.name, '--from-stdin'],
      input: ctx.value.split('\n'),
    }))
    .it('should read multiple lines from stdin', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathUpdateTest
    .add('input', (ctx) => `${ctx.value}\n${randomUUID()}\n${randomUUID()}`)
    .commandWithStdin((ctx) => ({
      argv: ['ssm:update', '--name', ctx.name, '--from-stdin', '--read-single-line'],
      input: ctx.input.split('\n'),
    }))
    .it('should only read the first line from stdin if --from-stdin and --read-single-line is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathUpdateTest
    .do((ctx) => ctx.sandbox.stub(ux, 'prompt').resolves(ctx.value))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name])
    .it('should prompt the user for the value', (ctx) => {
      sinon.assert.calledOnce(ux.prompt as SinonStub);
      sinon.assert.calledWith(ux.prompt as SinonStub, 'Value', sinon.match.has('type', 'mask'));

      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('value', ctx.value));
    });

  happyPathUpdateTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamValue').resolves(ctx.value))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value, '--skip-unchanged'])
    .it('should not update the parameter if the value has not changed', (ctx) => {
      sinon.assert.notCalled(ctx.ssmStore.writeParam);
    });

  happyPathUpdateTest
    .do((ctx) => ctx.sandbox.stub(ctx.ssmStore, 'getParamValue').resolves(`${ctx.value}_old`))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value, '--skip-unchanged'])
    .it('should update the parameter if the value has changed and skip unchanged is specified', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
    });

  happyPathUpdateTest
    .add('description', `${randomUUID} ${randomUUID}`)
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value, '--description', ctx.description])
    .it('should save the description if provided', (ctx) => {
      sinon.assert.calledOnce(ctx.ssmStore.writeParam);
      sinon.assert.calledWith(ctx.ssmStore.writeParam, sinon.match.has('description', ctx.description));
    });

  happyPathUpdateTest
    .commandWithContext((ctx) => ['ssm:update', '--value', ctx.value])
    .exit(1)
    .it('should require the --name flag', (ctx) => {
      expect(ctx.stderr).to.contain('name').and.contain('required');
    });

  happyPathUpdateTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      envVarName: ctx.envVarName,
      version: ctx.originalVersion,
    }))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value])
    .it('should save the current version to the config file', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('version', ctx.updatedVersion));
    });

  happyPathUpdateTest
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'getParamConfig').returns({
      envVarName: ctx.envVarName,
    }))
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.name, '--value', ctx.value])
    .it('should not lock the version in the config file if if the version was not previously locked', (ctx) => {
      sinon.assert.calledOnce(ctx.configFile.setParamConfig);
      sinon.assert.calledWith(ctx.configFile.setParamConfig, Source.SSM, ctx.name, sinon.match.has('version', undefined));
    });
});
