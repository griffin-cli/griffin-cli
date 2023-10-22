import { UnknownStoreError } from '../errors';

enum Source {
  SSM = 'SSM',
  S3 = 'S3',
  SecretsManager = 'SecretsManager',
}

export const isSource = (str: string): str is Source => Object.keys(Source).includes(str);

export const toSource = (str: string): Source => {
  const src = Object.keys(Source).find((source) => source.toLowerCase() === str.toLowerCase());
  if (!src) {
    throw new UnknownStoreError(str);
  }

  return src as Source;
};

export default Source;
