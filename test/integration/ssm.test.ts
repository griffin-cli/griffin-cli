import { stdin } from 'mock-stdin';

import test from '../helpers/register';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import clearSSM from '../helpers/clear-ssm';
import resetConfig from '../helpers/reset-config';
import clearTestScriptOutput from '../helpers/clear-test-script-output';
import { readFile } from 'fs/promises';
import addParam from '../helpers/add-param';
import { ParameterType } from '@aws-sdk/client-ssm';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SSM', () => {
  const ssmTest = test
    .setEnv('AWS_REGION', 'us-east-1')
    .setEnv('AWS_ACCESS_KEY_ID', 'abc')
    .setEnv('AWS_SECRET_ACCESS_KEY', '123')
    .stdout()
    .stderr()
    .add('stdin', () => stdin())
    .finally((ctx) => ctx.stdin.restore())
    .finally(() => resetConfig())
    .finally(() => clearTestScriptOutput())
    .finally(() => clearSSM());

  ssmTest
    .add('paramName', () => '/test/var')
    .add('paramValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.paramName, '--value', ctx.paramValue])
    .commandWithContext((ctx) => ['ssm:read', '--env', 'test', '--name', ctx.paramName, '--quiet'])
    .do((ctx) => expect(ctx.stdout).to.match(new RegExp(`^${ctx.paramValue}$`, 'm')))
    .add('updatedParamValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:update', '--env', 'test', '--name', ctx.paramName, '--value', ctx.updatedParamValue])
    .commandWithContext((ctx) => ['ssm:read', '--env', 'test', '--name', ctx.paramName, '--quiet'])
    .do((ctx) => expect(ctx.stdout).to.match(new RegExp(`^${ctx.updatedParamValue}$`, 'm')))
    .it('should print the updated value');

  ssmTest
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .add('param2', () => ({ name: '/param/two', envVarName: 'TWO', value: randomUUID() }))
    .add('param3', () => ({ name: '/param/three', envVarName: 'THREE', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param2.name, '--env-var-name', ctx.param2.envVarName, '--value', ctx.param2.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param3.name, '--env-var-name', ctx.param3.envVarName, '--value', ctx.param3.value])
    .command(['export', '--env', 'test', '--format', 'dotenv'])
    .it('should export to dotenv format', (ctx) => {
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param1.envVarName}=${ctx.param1.value}$`, 'm'));
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param2.envVarName}=${ctx.param2.value}$`, 'm'));
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param3.envVarName}=${ctx.param3.value}$`, 'm'));
    })

  ssmTest
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .add('param2', () => ({ name: '/param/two', envVarName: 'TWO', value: randomUUID() }))
    .add('param3', () => ({ name: '/param/three', envVarName: 'THREE', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param2.name, '--env-var-name', ctx.param2.envVarName, '--value', ctx.param2.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param3.name, '--env-var-name', ctx.param3.envVarName, '--value', ctx.param3.value])
    .commandWithContext((ctx) => ['exec', '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', `--name=${ctx.param1.envVarName}`, ctx.param2.envVarName, `--name=${ctx.param3.envVarName}`])
    .it('should execute the command', async (ctx) => {
      // This isn't great, but I can't find a way to guarantee the shell script has finished writing
      // to the file by now.
      await sleep(5_000)

      const output = (await readFile('./test-script-output.txt')).toString();

      expect(output).to.match(new RegExp(`^${ctx.param1.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param2.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param3.value}$`, 'm'));
    })

  const chamberImportTest = ssmTest
    .add('serviceName', 'griffin-cli')
    .add('serviceEnvName', 'griffin-cli-test')
    .add('params', (ctx) => [
      { name: `/${ctx.serviceName}/param-one`, value: randomUUID() },
      { name: `/${ctx.serviceName}/param-two`, value: randomUUID() },
      { name: `/${ctx.serviceEnvName}/param-three`, value: randomUUID() },
      { name: `/${ctx.serviceEnvName}/param-one`, value: randomUUID() },
    ])
    .do((ctx) => Promise.all(ctx.params.map((param) => addParam({
      name: param.name,
      value: param.value,
      type: ParameterType.SECURE_STRING,
    }))));

  chamberImportTest
    .commandWithContext((ctx) => ['ssm:import', '-c', ctx.serviceName, '-c', ctx.serviceEnvName])
    .do((ctx) => addParam({
      name: ctx.params[2].name,
      value: randomUUID(),
    }))
    .commandWithContext(() => ['exec', '--skip-exit', '--', './test/integration/test-script.sh', `--name=PARAM_ONE`, 'PARAM_TWO', `--name=PARAM_THREE`])
    .it('should import chamber params and lock the version', async (ctx) => {
      // This isn't great, but I can't find a way to guarantee the shell script has finished writing
      // to the file by now.
      await sleep(5_000)

      const output = (await readFile('./test-script-output.txt')).toString();

      expect(output).to.match(new RegExp(`^${ctx.params[1].value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.params[2].value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.params[3].value}$`, 'm'));
    })

  chamberImportTest
    .add('updatedParamValue', randomUUID())
    .commandWithContext((ctx) => ['ssm:import', '-c', ctx.serviceName, '-c', ctx.serviceEnvName, '--always-use-latest', '--allow-missing-value'])
    .do((ctx) => addParam({
      name: ctx.params[2].name,
      value: ctx.updatedParamValue,
    }))
    .commandWithContext(() => ['exec', '--skip-exit', '--', './test/integration/test-script.sh', `--name=PARAM_ONE`, 'PARAM_TWO', `--name=PARAM_THREE`])
    .it('should import chamber params without locking the version', async (ctx) => {
      // This isn't great, but I can't find a way to guarantee the shell script has finished writing
      // to the file by now.
      await sleep(5_000)

      const output = (await readFile('./test-script-output.txt')).toString();

      expect(output).to.match(new RegExp(`^${ctx.params[1].value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.params[3].value}$`, 'm'));

      expect(output).to.match(new RegExp(`^${ctx.updatedParamValue}$`, 'm'));
    })
});
