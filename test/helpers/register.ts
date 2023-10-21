import { test, command } from '@oclif/test';
import { Context } from 'mocha';
import { MockSTDIN, stdin } from 'mock-stdin';
import sinon, { SinonStubbedInstance } from 'sinon';
import { ConfigFile } from '../../src/config';

export default test
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
  .stdout()
  .stderr()
