import { Flags, Interfaces } from '@oclif/core';

import { Source } from '../../config/index.js';
import SSMBaseCommand from '../../ssm-base-command.js';

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
      await this.catch(err as Interfaces.CommandError);
    }
  }
}
