import { Flags } from '@oclif/core';

import { ParamConfig, Source } from '../../../config';
import ParameterConfigNotFoundError from '../../../errors/parameter-config-not-found-error';
import SSMBaseCommand from '../../../ssm-base-command';

export default class SSMConfigGet extends SSMBaseCommand<typeof SSMConfigGet> {
  static description = 'Get the config value for a parameter tracked by griffin.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var --config-name version',
    '<%= config.bin %> <%= command.id %> --name /example/var --all',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
    'config-name': Flags.string({
      char: 'c',
      description: 'the name of the config option',
      options: ['version', 'envVarName', 'allowMissingVersion'],
      exactlyOne: ['config-name', 'all'],
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'show the entire config for the parameter',
      exactlyOne: ['all', 'config-name'],
    }),
  };

  public async run(): Promise<void> {
    const paramConfig = await this.configFile.getParamConfig(
      Source.SSM,
      this.flags.name,
    );

    if (!paramConfig) {
      throw new ParameterConfigNotFoundError(this.flags.name);
    }

    if (this.flags.all) {
      this.logJson(paramConfig);
      return;
    }

    const configName = this.flags['config-name'] as keyof ParamConfig;

    switch (configName) {
      case 'envVarName': {
        this.log(paramConfig[configName] || 'not set');
        return;
      }

      case 'version': {
        this.log(paramConfig.version || 'latest');
        return;
      }

      case 'allowMissingValue': {
        this.log(paramConfig.allowMissingValue ? 'true' : 'false');
        return;
      }

      default: {
        this.log(paramConfig[configName] ?? 'not set');
      }
    }
  }
}
