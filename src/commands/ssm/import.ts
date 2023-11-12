import { readFile } from 'fs/promises';

import { ParameterType } from '@aws-sdk/client-ssm';
import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';
import { parse } from 'dotenv';

import { Source } from '../../config';
import ParameterAlreadyExistsError from '../../errors/parameter-already-exists.error';
import SSMBaseCommand from '../../ssm-base-command';
import { SSMStore } from '../../store';

export default class SSMImport extends SSMBaseCommand<typeof SSMImport> {
  static description = 'Import a parameter from Parameter Store or another config source.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
    '<%= config.bin %> <%= command.id %> --from-dotenv .env --prefix /example/path',
    '<%= config.bin %> <%= command.id %> --chamber-service /example',
    '<%= config.bin %> <%= command.id %> --chamber-service /example --allow-missing-value --always-use-latest',
  ];

  static flags = {
    'always-use-latest': Flags.boolean({
      char: 'l',
      description: 'do not lock the version, instead always pull the latest version',
    }),
    'allow-missing-value': Flags.boolean({
      char: 'm',
      description: 'do not fail when running exec or exporting variables if parameter does not exist',
    }),
    // SSM
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      exactlyOne: ['name', 'chamber-service', 'from-dotenv'],
      helpGroup: 'SSM',
    }),
    'env-var-name': Flags.string({
      char: 'e',
      description: 'the name of the environment variable that should be assigned the value of this parameter; default: normalized parameter name, without the prefix',
      dependsOn: ['name'],
      helpGroup: 'SSM',
    }),
    // chamber
    'chamber-service': Flags.string({
      char: 'c',
      description: 'import all parameters using this chamber service prefix',
      exactlyOne: ['name', 'chamber-service', 'from-dotenv'],
      multiple: true,
      helpGroup: 'CHAMBER',
    }),
    // dotenv
    'from-dotenv': Flags.string({
      char: 'd',
      description: 'import parameters from a dotenv file and save to Parameter Store; should start with a forward slash',
      dependsOn: ['prefix'],
      exactlyOne: ['name', 'chamber-service', 'from-dotenv'],
      helpGroup: 'DOTENV',
    }),
    prefix: Flags.string({
      description: 'the prefix to use when saving parameters from a dotenv file to Parameter Store',
      dependsOn: ['from-dotenv'],
      helpGroup: 'DOTENV',
    }),
    type: Flags.string({
      char: 't',
      description: 'the type for any parameters created in Parameter Store; default: SecureString',
      options: Object.values(ParameterType),
      dependsOn: ['from-dotenv'],
      helpGroup: 'DOTENV',
    }),
    overwrite: Flags.boolean({
      description: 'if a parameter already exists with the generated name, should it be overwritten',
      dependsOn: ['from-dotenv'],
      helpGroup: 'DOTENV',
    }),
  };

  public async run(): Promise<void> {
    try {
      if (this.flags.name) {
        await this.importSSMParameter();
      } else if (this.flags['chamber-service']) {
        await this.importChamberSecrets();
      } else if (this.flags['from-dotenv']) {
        await this.importDotEnvConfig();
      }
    } catch (err) {
      await this.catch(err as CommandError);
    }
  }

  private async importSSMParameter(): Promise<void> {
    if (this.configFile.hasParamConfig(Source.SSM, this.flags.name!)) {
      throw new ParameterAlreadyExistsError();
    }

    let version: string | undefined;
    if (!this.flags['always-use-latest']) {
      version = await this.ssmStore.getCurrentVersion(this.flags.name!);
    }

    this.configFile.setParamConfig(Source.SSM, this.flags.name!, {
      envVarName: this.flags['env-var-name'] || SSMStore.getEnvVarNameFromParamName(this.flags.name!),
      version,
      allowMissingValue: this.flags['allow-missing-value'],
    });

    await this.configFile.save();
  }

  private async importChamberSecrets(): Promise<void> {
    const params = await Promise.all(this.flags['chamber-service']!.map((prefix) => this.ssmStore.getParametersByPrefix(`/${prefix}`)));

    const seenVars = new Set();
    params
      .flat()
      // To mirror Chamber's behavior, we should only import the last parameter that is defined for
      // a given environment variable name.
      .reverse()
      .filter((param) => {
        const envVarName = SSMStore.getEnvVarNameFromParamName(param.name);
        if (seenVars.has(envVarName)) {
          return false;
        }

        seenVars.add(envVarName);
        return true;
      })
      .reverse()
      .forEach((param) => this.configFile.setParamConfig(Source.SSM, param.name, {
        envVarName: SSMStore.getEnvVarNameFromParamName(param.name),
        version: !this.flags['always-use-latest'] ? param.version : undefined,
        allowMissingValue: this.flags['allow-missing-value'],
      }));

    await this.configFile.save();
  }

  private async importDotEnvConfig(): Promise<void> {
    const fileContents = await readFile(this.flags['from-dotenv']!);
    const config = await parse(fileContents);
    const prefix = this.flags.prefix ? `/${this.flags.prefix.replace(/^\//, '').replace(/\/$/, '')}` : '';

    await Promise.all(Object.keys(config).map(async (envVarName) => {
      const name = `${prefix}/${envVarName}`;

      const { updatedVersion } = await this.ssmStore.writeParam({
        name,
        value: config[envVarName],
        type: this.flags.type as ParameterType ?? ParameterType.SECURE_STRING,
        allowOverwrite: this.flags.overwrite,
      });

      this.configFile.setParamConfig(Source.SSM, name, {
        envVarName,
        version: !this.flags['always-use-latest'] ? updatedVersion : undefined,
        allowMissingValue: this.flags['allow-missing-value'],
      });
    }));

    await this.configFile.save();
  }
}
