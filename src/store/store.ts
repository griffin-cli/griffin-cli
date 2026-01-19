import type { EnvVar } from '../types/env-var.js';
import type { ParamDefinition } from '../types/param-definition.js';

export interface Store {
  getEnvVars(params: ParamDefinition[]): Promise<EnvVar[]>
}
