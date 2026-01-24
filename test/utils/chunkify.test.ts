import { expect } from 'chai';
import chunkify from '../../src/utils/chunkify.js';

describe('chunkify', () => {
  it('should work with an empty array', () => {
    expect(chunkify([], 5)).to.deep.equal([[]]);
  });

  it('should work with an array smaller than the chunk size', () => {
    expect(chunkify([
      'a',
      'b',
    ], 5)).to.deep.equal([[
      'a',
      'b',
    ]]);
  });

  it('should work with an array equal to the chunk size', () => {
    expect(chunkify([
      'a',
      'b',
      'c',
      'd',
      'e',
    ], 5)).to.deep.equal([[
      'a',
      'b',
      'c',
      'd',
      'e',
    ]]);
  });

  it('should work with an array greater than the chunk size', () => {
    expect(chunkify([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
    ], 5)).to.deep.equal([
      [
        'a',
        'b',
        'c',
        'd',
        'e',
      ],
      [
        'f',
        'g',
      ],
    ]);
  });

  it('should work with an array that is a multiple of the chunk size', () => {
    expect(chunkify([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ], 5)).to.deep.equal([
      [
        '1',
        '2',
        '3',
        '4',
        '5',
      ],
      [
        '6',
        '7',
        '8',
        '9',
        '10',
      ],
    ]);
  });
});
