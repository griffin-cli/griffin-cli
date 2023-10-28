import { Flags, ux } from '@oclif/core';

export enum OutputFormat {
  CSV = 'csv',
  JSON = 'json',
  YAML = 'yaml',
}

export type DataLoggerOptions = Omit<ux.Table.table.Options, 'csv'> & {
  output?: OutputFormat;
};

export default class DataLogger {
  static readonly flags = {
    columns: Flags.string({
      exclusive: ['additional'],
      description: 'only show provided columns (comma-separated)',
    }),
    sort: Flags.string({
      description: 'property to sort by (prepend \'-\' for descending)',
    }),
    filter: Flags.string({
      description: 'filter property by partial string matching, ex: name=foo',
    }),
    output: Flags.string({
      exclusive: ['no-truncate'],
      description: 'the format for the output',
      options: Object.values(OutputFormat),
      default: OutputFormat.JSON,
    }),
    extended: Flags.boolean({
      char: 'x',
      description: 'show extra columns',
    }),
    'no-truncate': Flags.boolean({
      exclusive: ['output'],
      description: 'do not truncate output to fit screen',
    }),
    'no-header': Flags.boolean({
      exclusive: ['output'],
      description: 'hide table header from output',
    }),
  };

  static log<D extends Record<string, unknown>>(
    headers: ux.Table.table.Columns<D>,
    data: D[],
    opts: DataLoggerOptions,
  ): void {
    ux.table(data, headers, {
      ...opts,
    });
  }
}
