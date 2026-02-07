import { expect } from 'chai';
import StoreFactory from '../../src/store/store-factory.js';
import { Source } from '../../src/config/index.js';
import type { Store } from '../../src/store/store.js';
import type { EnvVar } from '../../src/types/env-var.js';
import { UnknownStoreError } from '../../src/errors/index.js';
import type { ParamDefinition } from '../../src/types/param-definition.js';

describe('StoreFactory', () => {
  class MockSSMStore implements Store {
    async getEnvVars(params: ParamDefinition[]): Promise<EnvVar[]> {
      return [];
    }
  }

  class TestStore implements Store {
    async getEnvVars(params: ParamDefinition[]): Promise<EnvVar[]> {
      return [];
    }
  }

  beforeEach(() => {
    (StoreFactory as any).reset();
  });

  afterEach(() => {
    (StoreFactory as any).reset();
  });

  it('should return the proper store', () => {
    StoreFactory.addStore(Source.SSM, new MockSSMStore());
    StoreFactory.addStore('TestStore' as unknown as Source, new TestStore());

    expect(StoreFactory.getStore(Source.SSM)).to.be.instanceOf(MockSSMStore);
  });

  it('should throw an error if there is already a source for the store', () => {
    StoreFactory.addStore(Source.SSM, new MockSSMStore());

    expect(() => StoreFactory.addStore(Source.SSM, new MockSSMStore()))
      .to.throw('Store already exists for store: SSM');
  });

  it('should throw an error if retrieving a store for an unknown source', () => {
    expect(() => StoreFactory.getStore(Source.SSM)).to.throw(UnknownStoreError);
  });
});
