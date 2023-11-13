import { test, expect } from '@oclif/test';

import EnvFile from '../../src/utils/envfile';

describe('EnvFile', () => {
  describe('stringify', () => {
    test.it('should convert a JSON object into dotenv format', () => {
      expect(EnvFile.stringify({
        str: 'a nice string',
        num: 42,
        bool: true,
        something: `!@$%&*()_-+=[]{};:,./<>?`,
        url: 'https://www.google.com/?q=recursion',
      })).to.equal(`STR=a nice string
NUM=42
BOOL=true
SOMETHING=!@$%&*()_-+=[]{};:,./<>?
URL=https://www.google.com/?q=recursion
`);
    });

    test.it('should omit fields set to undefined', () => {
      expect(EnvFile.stringify({
        first: 'first',
        und: undefined,
        second: 'second',
      })).to.equal(`FIRST=first
SECOND=second
`);
    });

    test.it('should leave fields set to null empty', () => {
      expect(EnvFile.stringify({
        none: null,
        one: 1,
      })).to.equal(`NONE=
ONE=1
`);
    });

    test.it('should wrap strings with newlines in quotes', () => {
      expect(EnvFile.stringify({
        multiline: `line1
line2
line3`
      })).to.equal(`MULTILINE="line1
line2
line3"
`)
    });

    test.it('should not wrap strings with escaped newlines in quotes', () => {
      expect(EnvFile.stringify({
        escapedMultiline: 'line1\\nline2\\nline3',
      })).to.equal(`ESCAPEDMULTILINE=line1\\nline2\\nline3
`);
    });

    test.it('should wrap strings with a comment delimiter in quotes', () => {
      const json = {
        commentedString: 'a string with a # in it',
      };

      expect(EnvFile.stringify(json)).to.equal(`COMMENTEDSTRING="${json.commentedString}"
`);
    });

    test.it('should use single quotes if the string contains double quotes', () => {
      expect(EnvFile.stringify({
        quotes: '"""""',
      })).to.equal(`QUOTES='"""""'
`);
    });
  });
});
