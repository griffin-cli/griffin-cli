import { readFile } from 'fs/promises';

import { ParameterType } from '@aws-sdk/client-ssm';
import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';
import { parse } from 'dotenv';
import { RateLimiter } from 'limiter';
import { Listr } from 'listr2';

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
    '<%= config.bin %> <%= command.id %> --chamber-service /example --optional --always-use-latest',
  ];

  static flags = {
    'always-use-latest': Flags.boolean({
      char: 'l',
      description: 'do not lock the version, instead always pull the latest version',
    }),
    optional: Flags.boolean({
      char: 'o',
      description: 'do not fail when running exec or exporting variables if parameter does not exist',
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'quiet (no output)',
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
      description: 'import parameters from a dotenv file and save to Parameter Store',
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
      allowMissingValue: this.flags.optional,
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
        allowMissingValue: this.flags.optional,
      }));

    await this.configFile.save();
  }

  private async importDotEnvConfig(): Promise<void> {
    let totalEnvVars = 0;
    let failureCount = 0;

    const tasks = new Listr<{ config?: Record<string, string> }>([
      {
        title: 'Loading dotenv file',
        task: async (ctx) => {
          const fileContents = await readFile(this.flags['from-dotenv'] || '.env');
          ctx.config = await parse(fileContents);
        },
      },
      {
        title: 'Uploading to SSM',
        task: async (ctx, task) => {
          const prefix = this.flags.prefix ? `/${this.flags.prefix.replace(/^\//, '').replace(/\/$/, '')}` : '';
          const envVarNames = Object.keys(ctx.config ?? {});

          totalEnvVars = envVarNames.length;

          const rateLimiter = new RateLimiter({
            // AWS doesn't clearly state the max throughput for `PutParameter` actions. From
            // experimentation, more than 3 requests per second is prone to surpass rate limits.
            tokensPerInterval: 3,
            interval: 'second',
          });

          await Promise.all(envVarNames.map(async (envVarName) => {
            try {
              await rateLimiter.removeTokens(1);

              const name = `${prefix}/${envVarName}`;

              // eslint-disable-next-line no-param-reassign
              task.output = `Creating ${name}`;

              const { updatedVersion } = await this.ssmStore.writeParam({
                name,
                value: ctx.config![envVarName],
                type: this.flags.type as ParameterType ?? ParameterType.SECURE_STRING,
                allowOverwrite: this.flags.overwrite,
              });

              this.configFile.setParamConfig(Source.SSM, name, {
                envVarName,
                version: !this.flags['always-use-latest'] ? updatedVersion : undefined,
                allowMissingValue: this.flags.optional,
              });
            } catch (err) {
              failureCount += 1;

              if (!this.flags.quiet) {
                this.logToStderr(`Failed to import ${envVarName}: ${err instanceof Error ? err.message : err}`);
              }
            }
          }));
        },
      },
      {
        title: 'Saving config',
        task: async () => {
          await this.configFile.save();
        },
      },
    ], { silentRendererCondition: () => this.flags.quiet });

    await tasks.run({});

    if (!this.flags.quiet && failureCount < totalEnvVars) {
      this.log(`Successfully imported ${totalEnvVars - failureCount} parameters.`);
    }
  }
}
