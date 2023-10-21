import { CLIError } from '@oclif/errors';

export default class ParameterVersionNotFoundError extends CLIError {
  constructor(
    public paramName: string,
    public version: string,
  ) {
    super(`Parameter version not found; Parameter: ${paramName}; Version: ${version}`);

    this.name = 'ParameterVersionNotFoundError';
  }
}
