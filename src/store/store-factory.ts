import Store from './store';
import { Source } from '../config';
import { UnknownStoreError } from '../errors';

export default class StoreFactory {
  private static stores: Partial<Record<Source, Store>> = {};

  static addStore(source: Source, store: Store): void {
    if (this.stores[source]) {
      throw new Error(`Store already exists for store: ${source}`);
    }

    this.stores[source] = store;
  }

  static getStore(source: Source): Store {
    const store = this.stores[source];

    if (!store) {
      throw new UnknownStoreError(source);
    }

    return store;
  }

  // For testing only.
  private static reset() {
    this.stores = {};
  }
}
