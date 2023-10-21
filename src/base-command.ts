import { Command, Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { ConfigFile } from './config';
import ExtendArgs from './types/extend-args';
import ExtendFlags from './types/extend-flags';

export default abstract class BaseCommand<T extends typeof Command & {
  configFile?: ConfigFile;
}> extends Command {
  protected flags!: ExtendFlags<typeof BaseCommand, T>;

  protected args!: ExtendArgs<T>;

  static baseFlags = {
    debug: Flags.string({
      hidden: true,
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

    this.configFile = (this.constructor as T).configFile
      || BaseCommand.configFile
      || await ConfigFile.loadConfig();
  }

  async catch(err: CommandError): Promise<void> {
    this.logToStderr(err.message);
    this.exit(err.exitCode || 1);
  }
}
