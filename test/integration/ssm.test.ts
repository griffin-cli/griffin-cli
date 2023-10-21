import { stdin } from 'mock-stdin';

import test from '../helpers/register';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import clearSSM from '../helpers/clear-ssm';

describe('SSM', () => {
  const ssmTest = test
    .stdout()
    .stderr()
    .add('stdin', () => stdin())
    .finally((ctx) => ctx.stdin.restore())
    .finally(() => clearSSM());

  ssmTest
    .add('paramName', () => '/test/var')
    .add('paramValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:create', '--name', ctx.paramName, '--value', ctx.paramValue])
    .commandWithContext((ctx) => ['ssm:read', '--name', ctx.paramName, '--quiet'])
    .do((ctx) => expect(ctx.stdin).to.match(new RegExp(`^${ctx.paramValue}\n`)))
    .add('updatedParamValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:update', '--name', ctx.paramName, '--value', ctx.updatedParamValue])
    .do((ctx) => expect(ctx.stdin).to.match(new RegExp(`^${ctx.updatedParamValue}\n`)))
    .it('should print the updated value');
});
