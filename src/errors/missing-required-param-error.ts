import { CLIError } from '@oclif/errors';

export default class MissingRequiredParamError extends CLIError {
  constructor(
    public id: string,
  ) {
    super(`Missing required parameter: ${id}`);

    this.name = 'MissingRequiredParamError';
  }
}
