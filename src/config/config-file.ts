import { readFile, stat, writeFile } from 'node:fs/promises';

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
  private static readonly filename = '.griffin-config.json';

  private constructor(
    private config: Config = {},
  ) { }

  static async doesExist(): Promise<boolean> {
    try {
      await stat(this.filename);

      return true;
    } catch (error) {
      if (error instanceof Error && (error as FileSystemError).code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }

  static async loadConfig(): Promise<ConfigFile> {
    return new ConfigFile(await this.loadConfigFromFile());
  }

  private static async loadConfigFromFile(): Promise<Config> {
    try {
      const data = await readFile(this.filename);

      return JSON.parse(data.toString());
    } catch (error) {
      if (error instanceof Error && (error as FileSystemError).code === 'ENOENT') {
        return {};
      }

      throw error;
    }
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
    await writeFile(ConfigFile.filename, JSON.stringify(this.config, undefined, 2));

    this.config = await ConfigFile.loadConfigFromFile();
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
