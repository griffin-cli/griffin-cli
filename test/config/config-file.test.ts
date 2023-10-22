import { test, expect } from '@oclif/test';
import mock from 'mock-fs';

import { ConfigFile, Source } from '../../src/config';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';

describe('ConfigFile', () => {
  const configFileTest = test
    .add('env', 'test')
    .finally(() => mock.restore());

  describe('Static Methods', () => {
    describe('doesExist', () => {
      configFileTest
        .do(() => mock({}))
        .do((ctx) => expect(ConfigFile.doesExist(ctx.env)).to.eventually.equal(false))
        .it('should return false if the file does not exist');

      configFileTest
        .do((ctx) => mock({
          [`.griffin-config.${ctx.env}.json`]: '',
        }))
        .do((ctx) => expect(ConfigFile.doesExist(ctx.env)).to.eventually.equal(true));
    });

    describe('loadConfig', () => {
      configFileTest
        .add('source', Source.SSM)
        .add('id', 'id')
        .do((ctx) => mock({
          [`.griffin-config.${ctx.env}.json`]: JSON.stringify({
            [ctx.source]: {
              [ctx.id]: {},
            },
          }),
        }))
        .do(async (ctx) => {
          const config = await ConfigFile.loadConfig(ctx.env);

          expect(config).to.be.instanceOf(ConfigFile);
          expect(config.hasParamConfig(ctx.source, ctx.id)).to.equal(true);
        })
        .it('should load the config');

      configFileTest
        .do(() => mock())
        .do((ctx) => expect(ConfigFile.loadConfig(ctx.env)).to.not.be.rejected)
        .it('should not throw an error if the config file does not exist');
    });
  });

  describe('Instance Methods', () => {
    const configInstanceTest = configFileTest
      .add('source', Source.SSM)
      .add('id', 'my_id')
      .add('paramConfig', {
        envVarName: 'TEST',
      })
      .add('configFileData', (ctx) => ({
        [ctx.source]: {
          [ctx.id]: ctx.paramConfig,
        },
      }))
      .do((ctx) => mock({
        [`.griffin-config.${ctx.env}.json`]: JSON.stringify(ctx.configFileData),
      }))
      .add('config', (ctx) => ConfigFile.loadConfig(ctx.env));

    describe('getParamConfig', () => {
      configInstanceTest
        .do((ctx) => expect(ctx.config.getParamConfig(ctx.source, ctx.id)).to.deep.equal(ctx.paramConfig))
        .it('should return the ParamConfig');

      configInstanceTest
        .do((ctx) => expect(ctx.config.getParamConfig(ctx.source, `${ctx.id}/does_not_exist`)).to.be.undefined)
        .it('should return undefined if the ID does not exist');

      configInstanceTest
        .do((ctx) => expect(ctx.config.getParamConfig('TestStore' as unknown as Source, ctx.id)).to.be.undefined)
        .it('should return undefined if the source does not exist');
    });

    describe('hasParamConfig', () => {
      configInstanceTest
        .do((ctx) => expect(ctx.config.hasParamConfig(ctx.source, ctx.id)).to.equal(true))
        .it('should return true if the ParamConfig exists');

      configInstanceTest
        .do((ctx) => expect(ctx.config.hasParamConfig(ctx.source, `${ctx.id}/does/not/exist`)).to.equal(false))
        .it('should return false if the ParamConfig does not exist');
    });

    describe('setParamConfig', () => {
      configInstanceTest
        .add('updatedParamConfig', (ctx) => ({
          ...ctx.paramConfig,
          envVarName: 'NEW_NAME',
          version: '5',
        }))
        .do((ctx) => ctx.config.setParamConfig(ctx.source, ctx.id, ctx.updatedParamConfig))
        .do((ctx) => expect(ctx.config.getParamConfig(ctx.source, ctx.id)).to.deep.equal(ctx.updatedParamConfig))
        .it('should update an existing ID');

      configInstanceTest
        .add('newId', randomUUID())
        .add('newParamConfig', {
          envVarName: 'NEW_NAME',
          version: '5',
        })
        .do((ctx) => ctx.config.setParamConfig(ctx.source, ctx.newId, ctx.newParamConfig))
        .do((ctx) => expect(ctx.config.getParamConfig(ctx.source, ctx.newId)).to.deep.equal(ctx.newParamConfig))
        .it('should add a new ID to an existing source');

      configInstanceTest
        .add('newSource', 'TestStore' as unknown as Source)
        .add('newId', randomUUID())
        .add('newParamConfig', {
          envVarName: 'NEW_NAME',
          version: '5',
        })
        .do((ctx) => ctx.config.setParamConfig(ctx.newSource, ctx.newId, ctx.newParamConfig))
        .do((ctx) => expect(ctx.config.getParamConfig(ctx.newSource, ctx.newId)).to.deep.equal(ctx.newParamConfig))
        .it('should add a new source');
    });

    describe('save', () => {
      configInstanceTest
        .do((ctx) => ctx.config.save())
        .do(async (ctx) => expect((await readFile(`.griffin-config.${ctx.env}.json`)).toString()).to.equal(JSON.stringify(ctx.configFileData, undefined, 2)))
        .it('should save to a file');
    });
  });
});