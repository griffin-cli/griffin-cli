import { CLIError } from '@oclif/errors';

export default class ParameterNotFoundError extends CLIError {
  constructor(
    id: string,
  ) {
    super(`Parameter not found: ${id}`);

    this.name = 'ParameterNotFoundError';
  }
}
