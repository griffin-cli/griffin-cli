import { ParameterType, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export default async ({ name, value, type }: {
  name: string,
  value: string,
  type?: ParameterType,
}) => {
  if (!process.env.GRIFFIN_AWS_SSM_ENDPOINT) {
    throw new Error('GRIFFIN_AWS_SSM_ENDPOINT not set, refusing to continue.');
  }

  const ssm = new SSMClient({
    endpoint: process.env.GRIFFIN_AWS_SSM_ENDPOINT,
  });

  const putCmd = new PutParameterCommand({
    Name: name,
    Value: value,
    Type: type,
    Overwrite: true,
  });

  await ssm.send(putCmd);
};
