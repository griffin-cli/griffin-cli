import { Command } from '@oclif/core';

import BaseCommand from './base-command.js';
import { SSMStore } from './store/index.js';

export default abstract class SSMBaseCommand<T extends typeof Command & {
  ssmStore?: SSMStore;
}> extends BaseCommand<T> {
  static ssmStore?: SSMStore;

  protected ssmStore!: SSMStore;

  async init(): Promise<void> {
    await super.init();

    this.ssmStore = (this.constructor as T).ssmStore
      || SSMBaseCommand.ssmStore
      || new SSMStore();
  }
}
