import { DeleteParametersCommand, DescribeParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

export default async () => {
  if (!process.env.GRIFFIN_AWS_SSM_ENDPOINT) {
    throw new Error('GRIFFIN_AWS_SSM_ENDPOINT not set, refusing to continue.');
  }

  const ssm = new SSMClient({
    endpoint: process.env.GRIFFIN_AWS_SSM_ENDPOINT,
  });

  let nextToken: string | undefined;

  do {
    const describeCmd = new DescribeParametersCommand({
      MaxResults: 50,
      NextToken: nextToken,
    });

    const res = await ssm.send(describeCmd);
    nextToken = res.NextToken;

    const deleteCmd = new DeleteParametersCommand({
      Names: res.Parameters?.map((param) => param.Name).filter((name) => !!name) as string[],
    });

    await ssm.send(deleteCmd);
  } while (nextToken);
};
