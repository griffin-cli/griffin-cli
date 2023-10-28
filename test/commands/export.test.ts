import { SinonStubbedInstance, SinonStub } from 'sinon';

import Export from '../../src/commands/export';
import test from '../helpers/register';
import { expect } from '@oclif/test';
import mock from 'mock-fs';
import { readFile, unlink } from 'fs/promises';
import { resolve } from 'path';

describe('export', () => {
  const exportTest = test
    .add('env', 'test')
    .add('envVars', () => ({
      TEST_STR: 'string',
      TEST_BOOL: 'true',
      TEST_NUMBER: '5',
    }))
    .do((ctx) => Export.configFile = ctx.configFile)
    .finally(() => Export.configFile = undefined)
    .do((ctx) => ctx.sandbox.stub(ctx.configFile, 'toParamDefinitions').returns({}))
    .do((ctx) => ctx.sandbox.stub(Export, 'getEnvVars').resolves(ctx.envVars));

  exportTest
    .commandWithContext((ctx) => ['export', '--format', 'json'])
    .it('should print the env vars in JSON format', (ctx) => {
      expect(ctx.stdout).to.equal(`${JSON.stringify(ctx.envVars)}\n`);
    });

  exportTest
    .command(['export', '--format', 'dotenv'])
    .it('should print the env vars in dotenv format', (ctx) => {
      expect(ctx.stdout).to.equal(`TEST_STR=string
TEST_BOOL=true
TEST_NUMBER=5
`);
    });

  exportTest
    .command(['export', '--format', 'yaml'])
    .it('should print the env vars in YAML format', (ctx) => {
      expect(ctx.stdout).to.equal(`TEST_STR: string
TEST_BOOL: "true"
TEST_NUMBER: "5"
`);
    });

  exportTest
    .command(['export', '--format', 'csv'])
    .it('should print the env vars in CSV format', (ctx) => {
      expect(ctx.stdout).to.equal(`TEST_STR,string
TEST_BOOL,true
TEST_NUMBER,5
`);
    });

  exportTest
    .add('filename', 'env.json')
    // I spent a while trying to get the mock filesystem to work, but it interfered with oclif, so
    // until I can revisit, will just use the underlying filesystem.
    .finally((ctx) => unlink(ctx.filename))
    .commandWithContext((ctx) => ['export', '--output', ctx.filename])
    .it('should write the env vars to the file specified', async (ctx) => {
      const fileContents = await readFile(ctx.filename);

      expect(fileContents.toString()).to.equal(JSON.stringify(ctx.envVars));
    });
});
