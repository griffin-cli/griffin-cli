import { Flags } from '@oclif/core';

import { ParamConfig, Source } from '../../../config';
import SSMBaseCommand from '../../../ssm-base-command';

export default class SSMConfigSet extends SSMBaseCommand<typeof SSMConfigSet> {
  static description = 'Set the config value for a parameter.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var --version 5',
    '<%= config.bin %> <%= command.id %> --name /example/var --no-allow-missing-value',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
    'env-var-name': Flags.string({
      char: 'e',
      description: 'if this parameter does not exist, specifies the name of the environment variable that should be assigned the value of this parameter; default: normalized parameter name, without the prefix',
    }),
    'always-use-latest': Flags.boolean({
      char: 'l',
      description: 'do not lock the version, instead always pull the latest version; if false, the latest version is pulled from Parameter Store and set as the current version; to use a different version, use --use-version instead',
      exclusive: ['use-version'],
    }),
    'allow-missing-value': Flags.boolean({
      char: 'm',
      description: 'do not fail when running exec or exporting variables if this parameter does not exist',
    }),
    'use-version': Flags.string({
      char: 'v',
      description: 'lock the version of the parameter to this version',
      exclusive: ['always-use-latest'],
    }),
  };

  public async run(): Promise<void> {
    const paramConfig = {
      ...this.configFile.getParamConfig(Source.SSM, this.flags.name),
    };

    if (this.flags['env-var-name']) {
      paramConfig.envVarName = this.flags['env-var-name'];
    }

    paramConfig.allowMissingValue = this.flags['allow-missing-value'] ?? paramConfig.allowMissingValue;
    paramConfig.envVarName = this.flags['env-var-name'] || paramConfig.envVarName;
    paramConfig.version = await this.getVersionValue(paramConfig);

    this.configFile.setParamConfig(Source.SSM, this.flags.name, paramConfig);
    await this.configFile.save();
  }

  private async getVersionValue(paramConfig: ParamConfig): Promise<string | undefined> {
    if (this.flags['use-version']) {
      return this.flags['use-version'];
    }

    const alwaysUseLatest = this.flags['always-use-latest'];

    if (typeof alwaysUseLatest !== 'boolean') {
      // Flag wasn't set, so don't change the current value.
      return paramConfig.version;
    }

    if (alwaysUseLatest) {
      // Don't lock the version, so return undefined.
      return undefined;
    }

    if (paramConfig.version) {
      // We're locking the version, but the version is already set, so don't change anything.
      return paramConfig.version;
    }

    return this.ssmStore.getCurrentVersion(this.flags.name);
  }
}
