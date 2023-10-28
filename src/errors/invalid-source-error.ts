import { CLIError } from '@oclif/errors';

export default class InvalidSourceError extends CLIError {
  constructor(
    public source: string,
  ) {
    super(`Invalid source: ${source}`);

    this.name = 'InvalidSourceError';
  }
}
