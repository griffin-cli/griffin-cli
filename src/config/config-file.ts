import {
  mkdir, readFile, stat, unlink, writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import yaml from 'yaml';

import ParamConfig from './param-config';
import Source from './source';
import SourceConfig from './source-config';
import ParamDefinition from '../types/param-definition';

type FileSystemError = Error & {
  errno: number;
  code: string;
  syscall: string;
  path: string;
};

type Config = Partial<Record<Source, SourceConfig>>;

export default class ConfigFile {
  private constructor(
    private env: string,
    private config: Config = {},
    private cwd?: string,
  ) { }

  static async doesExist(env: string): Promise<boolean> {
    try {
      await stat(this.getFileName(env));

      return true;
    } catch (error) {
      if (error instanceof Error && (error as FileSystemError).code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }

  static async loadConfig(env: string, cwd?: string): Promise<ConfigFile> {
    return new ConfigFile(env, await this.loadConfigFromFile(env, cwd), cwd);
  }

  static async migrateConfig(env: string, cwd?: string): Promise<void> {
    const fileName = `.griffin-config.${env}.json`;
    const filePath = cwd ? resolve(process.cwd(), cwd, fileName) : fileName;

    const data = await readFile(filePath, 'utf8');

    const configFile = new ConfigFile(env, JSON.parse(data), cwd);
    await configFile.save();

    await unlink(filePath);
  }

  private static async loadConfigFromFile(env: string, cwd?: string): Promise<Config> {
    try {
      const filename = this.getFileName(env);
      const filepath = cwd ? resolve(process.cwd(), cwd, filename) : filename;
      const data = await readFile(filepath, 'utf8');
      return yaml.parse(data);
    } catch (error) {
      if (error instanceof Error && (error as FileSystemError).code === 'ENOENT') {
        return {};
      }

      throw error;
    }
  }

  private static getFileName(env: string): string {
    return `.griffin-config.${env}.yaml`;
  }

  getParamConfig(source: Source, id: string): ParamConfig | undefined {
    return this.config[source]?.[id];
  }

  hasParamConfig(source: Source, id: string): boolean {
    return Boolean(this.getParamConfig(source, id));
  }

  setParamConfig(source: Source, id: string, paramConfig: ParamConfig): void {
    if (!this.config[source]) {
      this.config[source] = {};
    }

    this.config[source]![id] = paramConfig;
  }

  removeParamConfig(source: Source, id: string): void {
    delete this.config?.[source]?.[id];
  }

  async save(): Promise<void> {
    const filename = ConfigFile.getFileName(this.env);
    const filepath = this.cwd ? resolve(process.cwd(), this.cwd, filename) : filename;

    if (this.cwd) {
      // Make sure the directory exists.
      await mkdir(dirname(filepath), { recursive: true });
    }
    await writeFile(filepath, yaml.stringify(this.config));

    await this.reload();
  }

  async reload(): Promise<void> {
    this.config = await ConfigFile.loadConfigFromFile(this.env);
  }

  toParamDefinitions(): Partial<Record<Source, ParamDefinition[]>> {
    const paramDefinitions: Partial<Record<Source, ParamDefinition[]>> = {};

    (Object.keys(this.config) as Source[]).forEach((source) => {
      paramDefinitions[source] = Object.keys(this.config[source]!).map((id) => ({
        id,
        ...this.config[source]![id],
      }));
    });

    return paramDefinitions;
  }
}
