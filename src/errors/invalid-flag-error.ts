import { CLIError } from '@oclif/errors';

export default class InvalidFlagError extends CLIError {
  constructor(
    public flag: string,
    public reason: string,
  ) {
    super(`Invalid flag "--${flag}": ${reason}`);

    this.name = 'InvalidFlagError';
  }
}
