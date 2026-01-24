import { expect } from 'chai';
import mock from 'mock-fs';
import yaml from 'yaml';
import { ConfigFile, Source } from '../../src/config/index.js';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

describe('ConfigFile', () => {
  const env = 'test';

  afterEach(() => {
    mock.restore();
  });

  describe('Static Methods', () => {
    describe('doesExist', () => {
      it('should return false if the file does not exist', async () => {
        mock({});
        expect(await ConfigFile.doesExist(env)).to.equal(false);
      });

      it('should return true if the file exists', async () => {
        mock({
          [`.griffin-config.${env}.yaml`]: '',
        });
        expect(await ConfigFile.doesExist(env)).to.equal(true);
      });
    });

    describe('loadConfig', () => {
      it('should load the config', async () => {
        const source = Source.SSM;
        const id = 'id';
        mock({
          [`.griffin-config.${env}.yaml`]: yaml.stringify({
            [source]: {
              [id]: {},
            },
          }),
        });

        const config = await ConfigFile.loadConfig(env);

        expect(config).to.be.instanceOf(ConfigFile);
        expect(config.hasParamConfig(source, id)).to.equal(true);
      });

      it('should not throw an error if the config file does not exist', async () => {
        mock({});
        await expect(ConfigFile.loadConfig(env)).to.not.be.rejected;
      });

      it('should properly load the config when cwd is specified with a relative path', async () => {
        const cwd = './cwd_test';
        const source = Source.SSM;
        const id = randomUUID();
        mock({
          [`./${cwd}/.griffin-config.${env}.yaml`]: yaml.stringify({
            [source]: {
              [id]: {},
            },
          }),
        });

        const config = await ConfigFile.loadConfig(env, cwd);

        expect(config).to.be.instanceOf(ConfigFile);
        expect(config.hasParamConfig(source, id)).to.equal(true);
      });

      it('should properly load the config when cwd is specified with an absolute path', async () => {
        const cwd = '/var/cwd_test';
        const source = Source.SSM;
        const id = randomUUID();
        mock({
          [`${cwd}/.griffin-config.${env}.yaml`]: yaml.stringify({
            [source]: {
              [id]: {},
            },
          }),
        });

        const config = await ConfigFile.loadConfig(env, cwd);

        expect(config).to.be.instanceOf(ConfigFile);
        expect(config.hasParamConfig(source, id)).to.equal(true);
      });
    });

    describe('migrateConfig', () => {
      it('should convert the config to YAML', async () => {
        const config = {
          [Source.SSM]: {
            [randomUUID()]: {
              version: 5,
              envVarName: 'TEST_1',
            },
            [randomUUID()]: {
              envVarName: 'TEST_2',
            },
          },
        };
        mock({
          [`.griffin-config.${env}.json`]: JSON.stringify(config),
        });

        await ConfigFile.migrateConfig(env);

        expect((await readFile(`.griffin-config.${env}.yaml`)).toString()).to.equal(yaml.stringify(config));
      });

      it('should convert the config in a different directory to YAML if cwd is specified', async () => {
        const cwd = './test';
        const config = {
          [Source.SSM]: {
            [randomUUID()]: {
              version: 5,
              envVarName: 'TEST_1',
            },
            [randomUUID()]: {
              envVarName: 'TEST_2',
            },
          },
        };
        mock({
          [`${cwd}/.griffin-config.${env}.json`]: JSON.stringify(config),
        });

        await ConfigFile.migrateConfig(env, cwd);

        expect((await readFile(`${cwd}/.griffin-config.${env}.yaml`)).toString()).to.equal(yaml.stringify(config));
      });
    });
  });

  describe('Instance Methods', () => {
    const source = Source.SSM;
    const id = 'my_id';
    const paramConfig = {
      envVarName: 'TEST',
    };
    let config: ConfigFile;

    beforeEach(async () => {
      const configFileData = {
        [source]: {
          [id]: paramConfig,
        },
      };
      mock({
        [`.griffin-config.${env}.yaml`]: yaml.stringify(configFileData),
      });
      config = await ConfigFile.loadConfig(env);
    });

    describe('getParamConfig', () => {
      it('should return the ParamConfig', () => {
        expect(config.getParamConfig(source, id)).to.deep.equal(paramConfig);
      });

      it('should return undefined if the ID does not exist', () => {
        expect(config.getParamConfig(source, `${id}/does_not_exist`)).to.be.undefined;
      });

      it('should return undefined if the source does not exist', () => {
        expect(config.getParamConfig('TestStore' as unknown as Source, id)).to.be.undefined;
      });
    });

    describe('hasParamConfig', () => {
      it('should return true if the ParamConfig exists', () => {
        expect(config.hasParamConfig(source, id)).to.equal(true);
      });

      it('should return false if the ParamConfig does not exist', () => {
        expect(config.hasParamConfig(source, `${id}/does/not/exist`)).to.equal(false);
      });
    });

    describe('setParamConfig', () => {
      it('should update an existing ID', () => {
        const updatedParamConfig = {
          ...paramConfig,
          envVarName: 'NEW_NAME',
          version: '5',
        };
        config.setParamConfig(source, id, updatedParamConfig);
        expect(config.getParamConfig(source, id)).to.deep.equal(updatedParamConfig);
      });

      it('should add a new ID to an existing source', () => {
        const newId = randomUUID();
        const newParamConfig = {
          envVarName: 'NEW_NAME',
          version: '5',
        };
        config.setParamConfig(source, newId, newParamConfig);
        expect(config.getParamConfig(source, newId)).to.deep.equal(newParamConfig);
      });

      it('should add a new source', () => {
        const newSource = 'TestStore' as unknown as Source;
        const newId = randomUUID();
        const newParamConfig = {
          envVarName: 'NEW_NAME',
          version: '5',
        };
        config.setParamConfig(newSource, newId, newParamConfig);
        expect(config.getParamConfig(newSource, newId)).to.deep.equal(newParamConfig);
      });
    });

    describe('removeParamConfig', () => {
      it('should delete the param config', () => {
        config.removeParamConfig(source, id);
        expect(config.hasParamConfig(source, id)).to.equal(false);
      });

      it('should not throw an error if the param ID does not exist', () => {
        config.removeParamConfig(source, randomUUID());
      });

      it('should not throw an error if the source does not exist', () => {
        config.removeParamConfig(randomUUID() as Source, randomUUID());
      });
    });

    describe('save', () => {
      it('should save to a file', async () => {
        const configFileData = {
          [source]: {
            [id]: paramConfig,
          },
        };
        await config.save();
        expect((await readFile(`.griffin-config.${env}.yaml`)).toString()).to.equal(yaml.stringify(configFileData, undefined, 2));
      });
    });
  });
});
