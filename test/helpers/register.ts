import { test, command } from '@oclif/test';
import { stdin } from 'mock-stdin';
import sinon, { SinonStubbedInstance } from 'sinon';
import { ConfigFile } from '../../src/config';

export default test
  .add('_griffin', {} as Record<string, unknown> & {
    _env: Record<string, string | undefined>;
  })
  .add('configFile', () => new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>)
  .add('sandbox', () => sinon.createSandbox())
  .finally((ctx) => ctx.sandbox.restore())
  .add('stdin', () => stdin())
  .finally((ctx) => ctx.stdin.restore())
  .register('commandWithContext', (cb: (ctx: any) => string[]) => ({
    async run(ctx) {
      const args = cb(ctx);

      return command(args).run(ctx as any);
    },
  }))
  .register('commandWithStdin', (cb: (ctx: any) => {
    argv: string[];
    input: string | string[];
    delay?: number;
  }) => ({
    async run(ctx) {
      const { argv, input, delay } = cb(ctx);
      const $run = command(argv).run(ctx as any);

      setTimeout(() => ctx.stdin.send(input).end(), delay ?? 500);

      return $run;
    },
  }))
  .register('setEnv', (envVarName: string, envVarValue: string) => ({
    async run(ctx) {
      ctx._griffin = ctx._griffin || {};
      ctx._griffin._env = ctx._griffin._env || {};
      ctx._griffin._env[envVarName] = process.env[envVarName];

      process.env[envVarName] = envVarValue;
    },
    finally(ctx) {
      process.env[envVarName] = ctx._griffin._env[envVarName];
      delete ctx._griffin._env[envVarName];
    },
  }))
  .stdout()
  .stderr()
