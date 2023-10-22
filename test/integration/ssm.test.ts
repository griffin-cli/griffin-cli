import { stdin } from 'mock-stdin';

import test from '../helpers/register';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import clearSSM from '../helpers/clear-ssm';
import resetConfig from '../helpers/reset-config';
import clearTestScriptOutput from '../helpers/clear-test-script-output';
import { readFile } from 'fs/promises';

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
      const output = (await readFile('./test-script-output.txt')).toString();

      expect(output).to.match(new RegExp(`^${ctx.param1.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param2.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param3.value}$`, 'm'));
    })
});
