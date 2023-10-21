import {
  DeleteParameterCommand,
  GetParameterCommand,
  GetParameterHistoryCommand,
  GetParameterHistoryCommandOutput,
  GetParametersByPathCommand,
  GetParametersCommand,
  ParameterNotFound,
  ParameterType,
  ParameterVersionNotFound,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm';

import Store from './store';
import StoreFactory from './store-factory';
import { Source } from '../config';
import { MissingRequiredParamError, ParameterVersionNotFoundError, ParameterNotFoundError } from '../errors';
import EnvVar from '../types/env-var';
import ParamDefinition from '../types/param-definition';
import ParamRecord from '../types/param-record';
import { normalizeEnvVarName } from '../utils';
import chunkify from '../utils/chunkify';

export default class SSMStore implements Store {
  private readonly client: SSMClient;

  constructor(ssm?: SSMClient) {
    let client = ssm;
    if (!client) {
      client = new SSMClient({
        endpoint: process.env.GRIFFIN_AWS_SSM_ENDPOINT,
      });
    }

    this.client = client;
  }

  static getEnvVarNameFromParamName(name: string): string {
    return normalizeEnvVarName(name.split('/').pop()!);
  }

  private static convertAWSVersionToString(version: number | undefined): string | undefined {
    if (!version) {
      // Version is never 0 for SSMClient.
      return undefined;
    }

    return `${version}`;
  }

  private static getParameterName(name: string, version?: string): string {
    if (!version) {
      return name;
    }

    return `${name}:${version}`;
  }

  async delete(name: string): Promise<void> {
    try {
      const cmd = new DeleteParameterCommand({
        Name: name,
      });

      await this.client.send(cmd);
    } catch (error) {
      if (error instanceof ParameterNotFound) {
        return;
      }

      throw error;
    }
  }

  async getEnvVars(params: ParamDefinition[]): Promise<EnvVar[]> {
    const paramDefinition: Record<string, ParamDefinition> = {};
    const paramNames = params.map((config) => {
      paramDefinition[config.id] = config;

      return SSMStore.getParameterName(config.id, config.version);
    });

    const envVars: EnvVar[] = [];
    await Promise.all(chunkify(paramNames, 10).map(async (paramNamesChunk) => {
      const cmd = new GetParametersCommand({
        Names: paramNamesChunk,
        WithDecryption: true,
      });

      const res = await this.client.send(cmd);

      if (res.InvalidParameters?.length) {
        for (const paramName of res.InvalidParameters) {
          if (paramDefinition[paramName]?.allowMissingValue) {
            // eslint-disable-next-line no-continue
            continue;
          }

          throw new MissingRequiredParamError(paramName);
        }
      }

      res.Parameters?.forEach((param) => envVars.push({
        name: paramDefinition[param.Name!].envVarName!,
        value: param.Value!,
      }));
    }));

    return envVars;
  }

  async getHistory(name: string, limit?: number): Promise<ParamRecord[]> {
    return this.getParamRecords(name, limit);
  }

  async getCurrentVersion(name: string): Promise<string> {
    try {
      const cmd = new GetParameterCommand({
        Name: name,
      });

      const res = await this.client.send(cmd);

      if (!res.Parameter?.Version) {
        throw new ParameterNotFoundError(name);
      }

      return SSMStore.convertAWSVersionToString(res.Parameter.Version)!;
    } catch (error) {
      if (error instanceof ParameterNotFound) {
        throw new ParameterNotFoundError(name);
      }

      throw error;
    }
  }

  async getParamRecord(name: string, version: string): Promise<ParamRecord> {
    return this.getParamRecordForVersion(name, version);
  }

  async getParamValue(name: string, version?: string): Promise<string> {
    try {
      const cmd = new GetParameterCommand({
        Name: SSMStore.getParameterName(name, version),
        WithDecryption: true,
      });

      const res = await this.client.send(cmd);

      if (!res.Parameter?.Value) {
        throw new ParameterNotFoundError(name);
      }

      return res.Parameter.Value;
    } catch (error) {
      if (error instanceof ParameterNotFound) {
        throw new ParameterNotFoundError(name);
      } else if (error instanceof ParameterVersionNotFound) {
        throw new ParameterVersionNotFoundError(name, version!);
      }

      throw error;
    }
  }

  async getParametersByPrefix(prefix: string): Promise<{ name: string; version: string; }[]> {
    const records: { name: string; version: string; }[] = [];
    let nextToken: string | undefined;

    do {
      const cmd = new GetParametersByPathCommand({
        Path: prefix,
        MaxResults: 10,
        NextToken: nextToken,
      });

      const res = await this.client.send(cmd);

      nextToken = res.NextToken;

      res.Parameters?.forEach((param) => records.push({
        name: param.Name!,
        version: `${param.Version}`,
      }));
    } while (nextToken);

    return records;
  }

  async writeParam({
    name, value, type, description, allowOverwrite,
  }: {
    name: string;
    value: string;
    type?: ParameterType;
    description?: string;
    allowOverwrite?: boolean;
  }): Promise<{ updatedVersion: string }> {
    const cmd = new PutParameterCommand({
      Name: name,
      Description: description,
      Value: value,
      Type: type,
      Overwrite: allowOverwrite,
    });

    const res = await this.client.send(cmd);

    return {
      updatedVersion: SSMStore.convertAWSVersionToString(res.Version)!,
    };
  }

  private async getParamRecords(
    name: string,
    limit = Number.POSITIVE_INFINITY,
  ): Promise<ParamRecord[]> {
    const records: ParamRecord[] = [];
    let remainingCount = limit;
    let nextToken: string | undefined;

    do {
      const maxResults = (remainingCount > 50) ? 50 : remainingCount;

      const cmd = new GetParameterHistoryCommand({
        Name: name,
        WithDecryption: true,
        MaxResults: maxResults,
        NextToken: nextToken,
      });

      const res: GetParameterHistoryCommandOutput = await this.client.send(cmd);

      records.push(...(res.Parameters?.map((param): ParamRecord => ({
        name,
        value: param.Value,
        version: SSMStore.convertAWSVersionToString(param.Version),
        modifiedAt: param.LastModifiedDate,
        modifiedBy: param.LastModifiedUser,
      })) ?? []));

      nextToken = res.NextToken;
      remainingCount -= maxResults;
    } while (nextToken && remainingCount > 0);

    records.sort((a, b) => Number.parseInt(b.version ?? '0', 10) - Number.parseInt(a.version ?? '0', 10));

    return records;
  }

  private async getParamRecordForVersion(
    name: string,
    desiredVersion: string,
  ): Promise<ParamRecord> {
    const version = Number.parseInt(desiredVersion, 10);
    let nextToken: string | undefined;

    do {
      const cmd = new GetParameterHistoryCommand({
        Name: name,
        WithDecryption: true,
        MaxResults: 50,
        NextToken: nextToken,
      });

      const res: GetParameterHistoryCommandOutput = await this.client.send(cmd);

      const param = res.Parameters?.find((p) => p.Version === version);
      if (param) {
        return {
          name,
          value: param.Value,
          version: SSMStore.convertAWSVersionToString(param.Version),
          modifiedAt: param.LastModifiedDate,
          modifiedBy: param.LastModifiedUser,
        };
      }

      nextToken = res.NextToken;
    } while (nextToken);

    throw new ParameterVersionNotFoundError(name, desiredVersion);
  }
}

StoreFactory.addStore(Source.SSM, new SSMStore());
