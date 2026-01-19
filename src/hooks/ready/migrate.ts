import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Config, Hook, Interfaces } from '@oclif/core';

import { ConfigFile } from '../../config/index.js';

const legacyFileNamePattern = /^\.griffin-config\.(?<env>.*)\.json$/;

interface CliUx {
  confirm(prompt: string): Promise<boolean>;
}

interface CustomHooks extends Interfaces.Hooks {
  ready: {
    options: {
      Command: new (argv: string[], config: Config) => unknown;
      argv: string[];
      config: Config;
      configFile: ConfigFile;
      flags: Record<string, unknown>;
      args: Record<string, unknown>;
      ux: CliUx;
    };
    return: unknown;
  };
}

const hook: Hook<'ready', CustomHooks> = async function migrate(opts) {
  // Check for the legacy config file and migrate them to YAML.
  let cwd = process.cwd();
  if (opts.flags.cwd) {
    cwd = resolve(cwd, opts.flags.cwd as string);
  }

  const legacyConfigFileNames = (await readdir(cwd)).filter((n) => legacyFileNamePattern.test(n));
  if (!legacyConfigFileNames.length) {
    return;
  }

  this.warn('Legacy config file(s) detected.  Griffin won\'t be able to use these files unless they are migrated.');
  const shouldUpgrade = await opts.ux.confirm('Migrate to new format?');
  if (!shouldUpgrade) {
    return;
  }

  await Promise.all(legacyConfigFileNames.map(async (fileName) => {
    try {
      const match = legacyFileNamePattern.exec(fileName);
      const { env } = match?.groups || {};

      await ConfigFile.migrateConfig(env, opts.flags.cwd as string | undefined);
    } catch (err) {
      this.warn(`Could not convert "${fileName}": ${err}`);
    }
  }));
};

export default hook;
