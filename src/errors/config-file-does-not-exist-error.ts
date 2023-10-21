import { CLIError } from '@oclif/errors';

export default class ConfigFileDoesNotExistError extends CLIError {
  name = 'ConfigFileDoesNotExistError';

  constructor() {
    super('Config file could not be found.');
  }
}
