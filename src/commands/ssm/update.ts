import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { Source } from '../../config';
import ParameterConfigNotFoundError from '../../errors/parameter-config-not-found-error';
import SSMBaseCommand from '../../ssm-base-command';
import readValue from '../../utils/read-value';

export default class SSMWrite extends SSMBaseCommand<typeof SSMWrite> {
  static description = 'Update an existing parameter in Parameter Store.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
    '<%= config.bin %> <%= command.id %> --name /example/var --value example',
    '<%= config.bin %> <%= command.id %> --name /example/var --from-stdin',
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
    'skip-unchanged': Flags.boolean({
      char: 'u',
      description: 'skip updating the parameter if the value has not changed',
    }),
  };

  public async run(): Promise<void> {
    try {
      if (!this.configFile.hasParamConfig(Source.SSM, this.flags.name)) {
        throw new ParameterConfigNotFoundError(this.flags.name);
      }

      const value = await this.getValue();

      if (this.flags['skip-unchanged']) {
        const current = await this.ssmStore.getParamValue(this.flags.name);

        if (current === value) {
          this.log('not updating Parameter Store since values are equal');

          return;
        }
      }

      const { updatedVersion } = await this.ssmStore.writeParam({
        name: this.flags.name,
        value,
        description: this.flags.description,
        allowOverwrite: true,
      });

      const paramConfig = {
        ...(this.configFile.getParamConfig(Source.SSM, this.flags.name) || {}),
      };

      paramConfig.version = paramConfig.version && updatedVersion;

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
}
