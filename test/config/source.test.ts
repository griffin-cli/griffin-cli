import test, { expect } from '@oclif/test';
import Source, { isSource, toSource } from '../../src/config/source';
import { UnknownStoreError } from '../../src/errors';

describe('Source', () => {
  describe('isSource', () => {
    test
      .it('should return true for valid sources', () => {
        expect(isSource(Source.SSM)).to.equal(true);
      });

    test
      .it('should return false for invalid sources', () => {
        expect(isSource('FOOBAR')).to.equal(false);
      });
  });

  describe('toSource', () => {
    test
      .it('should return the source', () => {
        expect(toSource(Source.SSM)).to.equal(Source.SSM);
      });

    test
      .it('should work if it is using a different case', () => {
        expect(toSource('sSm')).to.equal(Source.SSM);
      });

    test
      .it('should return an error if the source is unknown', () => {
        expect(() => toSource('unknown')).to.throw(UnknownStoreError);
      });
  });
});
