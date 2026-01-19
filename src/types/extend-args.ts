import type { Command, Interfaces } from '@oclif/core';

export type ExtendArgs<T extends typeof Command> = Interfaces.InferredArgs<T['args']>;
