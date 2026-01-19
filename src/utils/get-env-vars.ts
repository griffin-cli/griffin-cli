import { Source } from '../config/index.js';
import { StoreFactory } from '../store/index.js';
import type { ParamDefinition } from '../types/param-definition.js';

export default async (
  paramDefinitions: Partial<Record<Source, ParamDefinition[]>>,
): Promise<Record<string, string>> => {
  const sources = Object.keys(paramDefinitions) as Source[];
  const envVarDefinitions = await Promise.all(sources.map((source) => StoreFactory
    .getStore(source)
    .getEnvVars(paramDefinitions[source]!)));

  return envVarDefinitions.flat().reduce((acc, envVar) => ({
    ...acc,
    [envVar.name]: envVar.value,
  }), {});
};
