import { expect } from 'chai';
import Source, { isSource, toSource } from '../../src/config/source.js';
import { UnknownStoreError } from '../../src/errors/index.js';

describe('Source', () => {
  describe('isSource', () => {
    it('should return true for valid sources', () => {
      expect(isSource(Source.SSM)).to.equal(true);
    });

    it('should return false for invalid sources', () => {
      expect(isSource('FOOBAR')).to.equal(false);
    });
  });

  describe('toSource', () => {
    it('should return the source', () => {
      expect(toSource(Source.SSM)).to.equal(Source.SSM);
    });

    it('should work if it is using a different case', () => {
      expect(toSource('sSm')).to.equal(Source.SSM);
    });

    it('should return an error if the source is unknown', () => {
      expect(() => toSource('unknown')).to.throw(UnknownStoreError);
    });
  });
});
