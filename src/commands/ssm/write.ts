import { ParameterType } from '@aws-sdk/client-ssm';
import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { ParamConfig, Source } from '../../config';
import SSMBaseCommand from '../../ssm-base-command';
import { SSMStore } from '../../store';
import readValue from '../../utils/read-value';

export default class SSMWrite extends SSMBaseCommand<typeof SSMWrite> {
  static description = 'Write a parameter to Parameter Store.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
    '<%= config.bin %> <%= command.id %> --name /example/var --value example',
    '<%= config.bin %> <%= command.id %> --name /example/var --from-stdin',
    '<%= config.bin %> <%= command.id %> --name /example/var --env-var-name EXAMPLE_VER --type SecureString',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
    description: Flags.string({
      char: 'd',
      description: 'the description for the parameter in Parameter Store',
      helpGroup: 'SSM CONFIG',
    }),
    type: Flags.string({
      char: 't',
      description: 'the type for the parameter, only has to be specified for new parameters; default: SecureString',
      options: Object.values(ParameterType),
      helpGroup: 'SSM CONFIG',
    }),
    value: Flags.string({
      char: 'v',
      description: 'the value of the parameter; if not specified and the value is not read from stdin, you will be prompted for the value',
      exclusive: ['read-single-line', 'from-stdin'],
      exactlyOne: [],
      helpGroup: 'VALUE INPUT',
    }),
    'from-stdin': Flags.boolean({
      description: 'use stdin to get the value',
      exclusive: ['value'],
      helpGroup: 'VALUE INPUT',
    }),
    'read-single-line': Flags.boolean({
      char: 'l',
      description: 'if reading from stdin, stop reading at \\n',
      exclusive: ['value'],
      dependsOn: ['from-stdin'],
      helpGroup: 'VALUE INPUT',
    }),
    'env-var-name': Flags.string({
      char: 'e',
      description: 'if this parameter does not exist, specifies the name of the environment variable that should be assigned the value of this parameter; default: normalized parameter name, without the prefix',
      helpGroup: 'GRIFFIN CONFIG',
    }),
    'always-use-latest': Flags.boolean({
      char: 'l',
      description: 'do not lock the version, instead always pull the latest version',
      helpGroup: 'GRIFFIN CONFIG',
    }),
    'optional': Flags.boolean({
      char: 'm',
      description: 'do not fail when running exec or exporting variables if this parameter does not exist',
      helpGroup: 'GRIFFIN CONFIG',
    }),
    'skip-unchanged': Flags.boolean({
      char: 'u',
      description: 'skip updating the parameter if the value has not changed',
    }),
  };

  public async run(): Promise<void> {
    try {
      const value = await this.getValue();

      if (this.flags['skip-unchanged']) {
        const current = await this.ssmStore.getParamValue(this.flags.name);

        if (current === value) {
          this.log('not updating Parameter Store since values are equal');

          return;
        }
      }

      const type = await this.getParameterType();

      const { updatedVersion } = await this.ssmStore.writeParam({
        name: this.flags.name,
        value,
        type,
        description: this.flags.description,
        allowOverwrite: true,
      });

      let paramConfig: ParamConfig = {};
      if (!this.configFile.hasParamConfig(Source.SSM, this.flags.name)) {
        let envVarName = this.flags['env-var-name'];
        if (!envVarName) {
          envVarName = SSMStore.getEnvVarNameFromParamName(this.flags.name);
        }

        paramConfig.envVarName = envVarName;
        paramConfig.allowMissingValue = this.flags['optional'];
      } else {
        paramConfig = this.configFile.getParamConfig(Source.SSM, this.flags.name) || {};

        paramConfig.envVarName = this.flags['env-var-name'] || paramConfig.envVarName;
        paramConfig.allowMissingValue = this.flags['optional'] ?? paramConfig.allowMissingValue;
      }

      paramConfig.version = this.flags['always-use-latest'] ? undefined : updatedVersion;

      this.configFile.setParamConfig(Source.SSM, this.flags.name, paramConfig);
      await this.configFile.save();
    } catch (err) {
      await this.catch(err as CommandError);
    }
  }

  private async getValue(): Promise<string> {
    if (this.flags.value) {
      return this.flags.value;
    }

    return readValue({
      useSTDIN: this.flags['from-stdin'],
      readSingleLine: this.flags['read-single-line'],
    });
  }

  private async getParameterType(): Promise<ParameterType | undefined> {
    if (this.flags.type) {
      return this.flags.type as ParameterType;
    }

    if (this.configFile.hasParamConfig(Source.SSM, this.flags.name)) {
      return undefined;
    }

    return ParameterType.SECURE_STRING;
  }
}
