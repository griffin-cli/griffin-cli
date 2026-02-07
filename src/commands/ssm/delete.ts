import { Flags, Interfaces } from '@oclif/core';

import { Source } from '../../config/index.js';
import SSMBaseCommand from '../../ssm-base-command.js';

export default class SSMDelete extends SSMBaseCommand<typeof SSMDelete> {
  static description = 'Permanently delete a parameter from Parameter Store and remove it from tracking.';

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
      await this.ssmStore.delete(this.flags.name);

      if (this.configFile.hasParamConfig(Source.SSM, this.flags.name)) {
        this.configFile.removeParamConfig(Source.SSM, this.flags.name);
        await this.configFile.save();
      }
    } catch (err) {
      await this.catch(err as Interfaces.CommandError);
    }
  }
}
