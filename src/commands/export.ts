import { writeFile } from 'fs/promises';

import { Flags } from '@oclif/core';
import * as csv from 'csv-stringify/sync';
import * as envfile from 'envfile';
import * as yaml from 'yaml';

import BaseCommand from '../base-command';
import { UnsupportedOptionsError } from '../errors';
import getEnvVars from '../utils/get-env-vars';

export enum ExportOutputFormat {
  JSON = 'json',
  DOTENV = 'dotenv',
  YAML = 'yaml',
  CSV = 'csv',
}

export default class Export extends BaseCommand<typeof Export> {
  static description = 'Export parameters in the specified format.';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format json',
    '<%= config.bin %> <%= command.id %> --output ./.env --format dotenv',
  ];

  static flags = {
    format: Flags.string({
      char: 'f',
      description: 'output format',
      options: Object.values(ExportOutputFormat),
      default: ExportOutputFormat.JSON,
    }),
    output: Flags.string({
      char: 'o',
      description: 'output file; if not specified, prints to stdout',
    }),
  };

  static getEnvVars = getEnvVars;

  public async run(): Promise<void> {
    const envVars = await Export.getEnvVars(this.configFile.toParamDefinitions());

    switch (this.flags.format as ExportOutputFormat) {
      case ExportOutputFormat.JSON: {
        return this.print(JSON.stringify(envVars));
      }

      case ExportOutputFormat.DOTENV: {
        return this.print(envfile.stringify(envVars));
      }

      case ExportOutputFormat.YAML: {
        return this.print(yaml.stringify(envVars));
      }

      case ExportOutputFormat.CSV: {
        return this.print(csv.stringify(Object
          .keys(envVars)
          .map((envVarName) => [envVarName, envVars[envVarName]])));
      }

      default: {
        throw new UnsupportedOptionsError(this.flags.format);
      }
    }
  }

  private async print(data: string): Promise<void> {
    if (!this.flags.output) {
      this.log(data.trim());
      return;
    }

    await writeFile(this.flags.output, data);
  }
}
