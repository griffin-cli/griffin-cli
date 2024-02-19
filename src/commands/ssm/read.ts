import { Flags } from '@oclif/core';
import { CommandError } from '@oclif/core/lib/interfaces';

import { ConfigFile, Source } from '../../config';
import { ConfigFileDoesNotExistError } from '../../errors';
import ParameterConfigNotFoundError from '../../errors/parameter-config-not-found-error';
import SSMBaseCommand from '../../ssm-base-command';
import { DataLogger } from '../../utils';
import { OutputFormat } from '../../utils/data-logger';

export default class SSMRead extends SSMBaseCommand<typeof SSMRead> {
  static description = 'Read a parameter from Parameter Store.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --name /example/var',
    '<%= config.bin %> <%= command.id %> --name /example/var --latest',
    '<%= config.bin %> <%= command.id %> --name /example/var --version 3 --quiet',
  ];

  static flags = {
    name: Flags.string({
      char: 'n',
      description: 'the name of the parameter',
      required: true,
    }),
    version: Flags.string({
      char: 'v',
      description: 'the version of the parameter to read, defaults to the version in your .griffon-config.yaml file',
      exclusive: ['latest'],
    }),
    latest: Flags.boolean({
      char: 'l',
      description: 'read the latest version',
      exclusive: ['version'],
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'print only the parameter value',
    }),
    ...DataLogger.flags,
  };

  public async run(): Promise<void> {
    try {
      let { version } = this.flags;
      if (!version) {
        if (this.flags.latest) {
          version = await this.ssmStore.getCurrentVersion(this.flags.name);
        } else {
          if (!await ConfigFile.doesExist(this.flags.env)) {
            throw new ConfigFileDoesNotExistError();
          }

          const paramConfig = this.configFile.getParamConfig(Source.SSM, this.flags.name);
          if (!paramConfig) {
            throw new ParameterConfigNotFoundError(this.flags.name);
          }

          version = paramConfig.version ? paramConfig.version : await this
            .ssmStore
            .getCurrentVersion(
              this.flags.name,
            );
        }
      }

      const res = await this.ssmStore.getParamRecord(this.flags.name, version);

      if (this.flags.quiet) {
        this.log(res.value);

        return;
      }

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
        [res],
        {
          columns: this.flags.columns,
          sort: this.flags.sort,
          filter: this.flags.filter,
          output: this.flags.output as OutputFormat,
          extended: this.flags.extended,
          'no-truncate': this.flags['no-truncate'],
          'no-header': this.flags['no-header'],
        },
      );
    } catch (err) {
      await this.catch(err as CommandError);
    }
  }
}
