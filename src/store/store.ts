import EnvVar from '../types/env-var';
import ParamDefinition from '../types/param-definition';

export default interface Store {
  getEnvVars(params: ParamDefinition[]): Promise<EnvVar[]>
}
