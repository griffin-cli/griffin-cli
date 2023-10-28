import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { Source } from '../../config';
import SSMBaseCommand from '../../ssm-base-command';

export default class SSMRemove extends SSMBaseCommand<typeof SSMRemove> {
  static description = 'Remove a parameter without deleting it from Parameter Store.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
  };

  public async run(): Promise<void> {
    try {
      this.configFile.removeParamConfig(Source.SSM, this.flags.name);

      await this.configFile.save();
    } catch (err) {
      await this.catch(err as CommandError);
    }
  }
}
