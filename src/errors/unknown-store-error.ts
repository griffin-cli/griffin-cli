import { CLIError } from '@oclif/errors';

export default class UnknownStoreError extends CLIError {
  constructor(
    source: string,
  ) {
    super(`Store not found for source: ${source}`);

    this.name = 'UnknownStoreError';
  }
}
