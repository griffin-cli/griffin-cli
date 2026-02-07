import type { Command, Interfaces } from '@oclif/core';

export type ExtendFlags<B extends typeof Command, T extends typeof Command> = Interfaces.InferredFlags<B['baseFlags'] & T['flags']>;
