import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import SSMBaseCommand from '../../ssm-base-command';
import { DataLogger } from '../../utils';
import { DataLoggerOptions } from '../../utils/data-logger';

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
      await this.catch(err as CommandError);
    }
  }
}
