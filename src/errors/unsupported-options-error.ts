import { CLIError } from '@oclif/errors';

export default class UnsupportedOptionsError extends CLIError {
  name = 'UnsupportedOptionsError';

  constructor(
    public optionName: string,
  ) {
    super(`Unsupported option: ${optionName}`);
  }
}
