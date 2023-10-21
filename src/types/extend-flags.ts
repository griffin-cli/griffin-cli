import { Command, Interfaces } from '@oclif/core';

type ExtendFlags<B extends typeof Command, T extends typeof Command> = Interfaces.InferredFlags<B['baseFlags'] & T['flags']>;

export default ExtendFlags;
