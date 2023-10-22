import { stdin } from 'mock-stdin';

import test from '../helpers/register';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import clearSSM from '../helpers/clear-ssm';
import resetConfig from '../helpers/reset-config';

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
});
