import { Command, Interfaces } from '@oclif/core';

type ExtendArgs<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;

export default ExtendArgs;
