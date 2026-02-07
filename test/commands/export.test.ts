import { expect } from 'chai';
import sinon, { SinonSandbox, SinonStubbedInstance } from 'sinon';
import { runCommand } from '@oclif/test';
import { readFile, unlink } from 'fs/promises';

import Export from '../../src/commands/export.js';
import { ConfigFile } from '../../src/config/index.js';

describe('export', () => {
  let sandbox: SinonSandbox;
  let configFile: SinonStubbedInstance<ConfigFile>;
  const envVars = {
    TEST_STR: 'string',
    TEST_BOOL: 'true',
    TEST_NUMBER: '5',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    configFile = new (ConfigFile as unknown as { new(): ConfigFile })() as SinonStubbedInstance<ConfigFile>;
    Export.configFile = configFile;
    sandbox.stub(configFile, 'toParamDefinitions').returns({});
    sandbox.stub(Export, 'getEnvVars').resolves(envVars);
  });

  afterEach(() => {
    Export.configFile = undefined;
    sandbox.restore();
  });

  it('should print the env vars in JSON format', async () => {
    const { stdout } = await runCommand(['export', '--format', 'json']);
    expect(stdout).to.equal(`${JSON.stringify(envVars)}\n`);
  });

  it('should print the env vars in dotenv format', async () => {
    const { stdout } = await runCommand(['export', '--format', 'dotenv']);
    expect(stdout).to.equal(`TEST_STR=string
TEST_BOOL=true
TEST_NUMBER=5
`);
  });

  it('should print the env vars in YAML format', async () => {
    const { stdout } = await runCommand(['export', '--format', 'yaml']);
    expect(stdout).to.equal(`TEST_STR: string
TEST_BOOL: "true"
TEST_NUMBER: "5"
`);
  });

  it('should print the env vars in CSV format', async () => {
    const { stdout } = await runCommand(['export', '--format', 'csv']);
    expect(stdout).to.equal(`TEST_STR,string
TEST_BOOL,true
TEST_NUMBER,5
`);
  });

  it('should write the env vars to the file specified', async () => {
    const filename = 'env.json';
    try {
      await runCommand(['export', '--output', filename]);
      const fileContents = await readFile(filename);
      expect(fileContents.toString()).to.equal(JSON.stringify(envVars));
    } finally {
      await unlink(filename);
    }
  });
});
