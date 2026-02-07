import { Flags, Interfaces } from '@oclif/core';

import SSMBaseCommand from '../../ssm-base-command.js';
import { DataLoggerOptions } from '../../utils/data-logger.js';
import { DataLogger } from '../../utils/index.js';

export default class SSMHistory extends SSMBaseCommand<typeof SSMHistory> {
  static description = 'View the history of a parameter.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
    ...DataLogger.flags,
  };

  public async run(): Promise<void> {
    try {
      const records = await this.ssmStore.getHistory(this.flags.name);

      DataLogger.log(
        {
          name: {},
          description: {
            extended: true,
          },
          value: {},
          version: {},
          modifiedAt: {},
          modifiedBy: {},
        },
        records,
        this.flags as DataLoggerOptions,
      );
    } catch (err) {
      await this.catch(err as Interfaces.CommandError);
    }
  }
}
