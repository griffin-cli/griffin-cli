import { CLIError } from '@oclif/errors';

export default class ParameterAlreadyExistsError extends CLIError {
  constructor() {
    super('Parameter already exists.');

    this.name = 'ParameterAlreadyExistsError';
  }
}
