import { CLIError } from '@oclif/errors';

export default class MissingRequiredFlagError extends CLIError {
  name = 'MissingRequiredFlagError';

  constructor(
    public flagName: string,
  ) {
    const flag = flagName.startsWith('--') ? flagName : `--${flagName}`;

    super(`Missing required flag: ${flag}`);
  }
}
