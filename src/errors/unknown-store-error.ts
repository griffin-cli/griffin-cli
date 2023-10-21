import { CLIError } from '@oclif/errors';

import { Source } from '../config';

export default class UnknownStoreError extends CLIError {
  constructor(
    source: Source,
  ) {
    super(`Store not found for source: ${source}`);

    this.name = 'UnknownStoreError';
  }
}
