enum Source {
  SSM = 'SSM',
  S3 = 'S3',
  SecretsManager = 'SecretsManager',
}

export const isSource = (str: string): str is Source => Object.keys(Source).includes(str);

export default Source;
