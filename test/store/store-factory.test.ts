import { test, expect } from '@oclif/test'

import StoreFactory from '../../src/store/store-factory';
import { Source } from '../../src/config';
import Store from '../../src/store/store';
import EnvVar from '../../src/types/env-var';
import { UnknownStoreError } from '../../src/errors';
import ParamDefinition from '../../src/types/param-definition';

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

  const storeFactoryTest = test
    .do(() => (StoreFactory as any).reset())
    .finally(() => {
      (StoreFactory as any).reset();
    })

  storeFactoryTest
    .do(() => {
      StoreFactory.addStore(Source.SSM, new MockSSMStore());
      StoreFactory.addStore('TestStore' as unknown as Source, new TestStore());

      expect(StoreFactory.getStore(Source.SSM)).to.be.instanceOf(MockSSMStore);
    })
    .it('should return the proper store')

  storeFactoryTest
    .do(() => {
      StoreFactory.addStore(Source.SSM, new MockSSMStore());
      StoreFactory.addStore(Source.SSM, new MockSSMStore());
    })
    .catch('Store already exists for store: SSM')
    .it('should throw an error if there is already a source for the store')

  storeFactoryTest
    .do(() => {
      StoreFactory.getStore(Source.SSM);
    })
    .catch((err) => expect(err).to.be.instanceOf(UnknownStoreError))
    .it('should throw an error if retrieving a store for an unknown source')
})