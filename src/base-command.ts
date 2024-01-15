import { Command, Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { ConfigFile } from './config';
import InvalidFlagError from './errors/invalid-flag-error';
import ExtendArgs from './types/extend-args';
import ExtendFlags from './types/extend-flags';

export default abstract class BaseCommand<T extends typeof Command & {
  configFile?: ConfigFile;
}> extends Command {
  protected static envPattern = /^[A-Za-z_-]+$/;

  protected flags!: ExtendFlags<typeof BaseCommand, T>;

  protected args!: ExtendArgs<T>;

  static baseFlags = {
    debug: Flags.string({
      hidden: true,
    }),
    env: Flags.string({
      description: 'the name of the environment (e.g. prod, qa, staging), this can be any alphanumeric string; default: default',
      default: 'default',
      char: 'E',
    }),
    cwd: Flags.string({
      description: 'the directory where griffin\'s config file is located, both relative and absolute paths are supported; default: .',
    }),
  };

  static configFile?: ConfigFile;

  protected configFile!: ConfigFile;

  async init(): Promise<void> {
    await super.init();

    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: super.ctor.baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });

    this.flags = flags as ExtendFlags<typeof BaseCommand, T>;
    this.args = args as ExtendArgs<T>;

    if (!BaseCommand.envPattern.test(this.flags.env)) {
      throw new InvalidFlagError('--env', 'Environment must only contain alphanumeric characters and "_" or "-".');
    }

    this.configFile = (this.constructor as T).configFile
      || BaseCommand.configFile
      || await ConfigFile.loadConfig(this.flags.env, this.flags.cwd);
  }

  async catch(err: CommandError): Promise<void> {
    this.logToStderr(err.message);
    this.exit(err.exitCode || 1);
  }
}
