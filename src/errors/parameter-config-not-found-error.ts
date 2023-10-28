import { CLIError } from '@oclif/errors';

export default class ParameterConfigNotFoundError extends CLIError {
  name = 'ParameterConfigNotFoundError';

  constructor(
    public id: string,
  ) {
    super(`Parameter config not found: ${id}`);
  }
}
