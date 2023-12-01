import { randomUUID } from 'crypto';
import Sinon, { SinonStubbedInstance } from 'sinon';

import test from '../../helpers/register';
import EnvFile from '../../../src/utils/envfile';
import { SSMStore } from '../../../src/store';
import SSMImport from '../../../src/commands/ssm/import';
import { Source } from '../../../src/config';
import { normalizeEnvVarName } from '../../../src/utils';
import { unlink, writeFile } from 'fs/promises';
import { expect } from '@oclif/test';

describe('ssm:import', () => {
  describe('--from-dotenv', () => {
    const dotEnvTest = test
      .add('prefix', () => `/${randomUUID()}`)
      .add('dotenvFilename', () => `${randomUUID()}.env`)
      .add('jsonConfig', () => ({
        URL: 'https://www.google.com/q?emacs',
        number: 42,
        bool: true,
        multiLineString: 'line1\nline2\nline3',
        escapedMultiLineString: 'line1\\nline2\\nline3',
      }))
      .add('dotenvContents', (ctx) => EnvFile.stringify(ctx.jsonConfig))
      // Mocking out the filesystem causes issues with oclif, so will instead attempt to clean up real files.
      .do((ctx) => writeFile(ctx.dotenvFilename, ctx.dotenvContents))
      .finally((ctx) => unlink(ctx.dotenvFilename))
      .add('ssmStore', () => new SSMStore() as SinonStubbedInstance<SSMStore>)
      .do((ctx) => SSMImport.ssmStore = ctx.ssmStore)
      .finally(() => SSMImport.ssmStore = undefined)
      .do((ctx) => SSMImport.configFile = ctx.configFile)
      .finally(() => SSMImport.configFile = undefined);

    const happyPathDotEnvTest = dotEnvTest
      .do((ctx) => {
        ctx.sandbox.stub(ctx.ssmStore, 'writeParam').resolves({ updatedVersion: '1' });
        ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns();
        ctx.sandbox.stub(ctx.configFile, 'save').resolves();
      });

    const uploadFailureTest = dotEnvTest
      .add('uploadErr', () => new Error('there was an error, probably something with param name'))
      .do((ctx) => {
        ctx.sandbox
          .stub(ctx.ssmStore, 'writeParam')
          .resolves({ updatedVersion: '1' })
          .onSecondCall().rejects(ctx.uploadErr);
        ctx.sandbox.stub(ctx.configFile, 'setParamConfig').returns();
        ctx.sandbox.stub(ctx.configFile, 'save').resolves();
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should upload all the parameters to SSM', (ctx) => {
        Sinon.assert.callCount(ctx.ssmStore.writeParam, Object.keys(ctx.jsonConfig).length);
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should add all of the parameters to the config file', (ctx) => {
        Sinon.assert.callCount(ctx.configFile.setParamConfig, Object.keys(ctx.jsonConfig).length);

        Object
          .keys(ctx.jsonConfig)
          .forEach((key) => Sinon.assert.calledWith(
            ctx.configFile.setParamConfig,
            Source.SSM,
            `${ctx.prefix}/${key.toUpperCase()}`,
          ));
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should upload the parameters properly if the prefix starts with a forward slash', (ctx) => {
        Object.keys(ctx.jsonConfig).forEach((key) => {
          const expectedName = `${ctx.prefix}/${normalizeEnvVarName(key)}`;

          Sinon.assert.calledWith(
            ctx.ssmStore.writeParam,
            Sinon
              .match
              .has('name', expectedName)
              .and(Sinon.match.has('value', `${ctx.jsonConfig[key as keyof typeof ctx.jsonConfig]}`))
          );
        });
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix.replace(/^\//, '')])
      .it('should upload the parameters properly if the prefix does not start with a forward slash', (ctx) => {
        Object.keys(ctx.jsonConfig).forEach((key) => {
          const expectedName = `${ctx.prefix}/${normalizeEnvVarName(key)}`;

          Sinon.assert.calledWith(
            ctx.ssmStore.writeParam,
            Sinon
              .match
              .has('name', expectedName)
              .and(Sinon.match.has('value', `${ctx.jsonConfig[key as keyof typeof ctx.jsonConfig]}`))
          );
        });
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', `${ctx.prefix}/`])
      .it('should upload the parameters properly if the prefix ends with a forward slash', (ctx) => {
        Object.keys(ctx.jsonConfig).forEach((key) => {
          const expectedName = `${ctx.prefix}/${normalizeEnvVarName(key)}`;

          Sinon.assert.calledWith(
            ctx.ssmStore.writeParam,
            Sinon
              .match
              .has('name', expectedName)
              .and(Sinon.match.has('value', `${ctx.jsonConfig[key as keyof typeof ctx.jsonConfig]}`))
          );
        });
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should upload the parameters properly if the prefix does not end with a forward slash', (ctx) => {
        Object.keys(ctx.jsonConfig).forEach((key) => {
          const expectedName = `${ctx.prefix}/${normalizeEnvVarName(key)}`;

          Sinon.assert.calledWith(
            ctx.ssmStore.writeParam,
            Sinon
              .match
              .has('name', expectedName)
              .and(Sinon.match.has('value', `${ctx.jsonConfig[key as keyof typeof ctx.jsonConfig]}`))
          );
        });
      });

    uploadFailureTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should log a failure to upload a parameter', (ctx) => {
        expect(ctx.stderr.trim()).to.equal(`Failed to import NUMBER: ${ctx.uploadErr.message}`);
      });

    uploadFailureTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should not exit if a parameter fails to upload to SSM', (ctx) => {
        expect(ctx.stdout.trim()).to.match(new RegExp(`Successfully imported ${Object.keys(ctx.jsonConfig).length - 1} parameters.$`));
      });

    uploadFailureTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix, '--quiet'])
      .it('should not log a failure if the quiet flag is specified', (ctx) => {
        expect(ctx.stderr.trim()).to.equal('');
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix, '--always-use-latest'])
      .it('should not lock the version if --always-use-latest is specified', (ctx) => {
        Sinon.assert.callCount(ctx.configFile.setParamConfig, Object.keys(ctx.jsonConfig).length);
        Sinon.assert.alwaysCalledWith(ctx.configFile.setParamConfig, Source.SSM, Sinon.match.string, Sinon.match.has('version', undefined));
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should lock the version', (ctx) => {
        Sinon.assert.callCount(ctx.configFile.setParamConfig, Object.keys(ctx.jsonConfig).length);
        Sinon.assert.alwaysCalledWith(ctx.configFile.setParamConfig, Source.SSM, Sinon.match.string, Sinon.match.has('version', '1'));
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix, '--allow-missing-value'])
      .it('should allow missing values if --allow-missing-value is specified', (ctx) => {
        Sinon.assert.callCount(ctx.configFile.setParamConfig, Object.keys(ctx.jsonConfig).length);
        Sinon.assert.alwaysCalledWith(ctx.configFile.setParamConfig, Source.SSM, Sinon.match.string, Sinon.match.has('allowMissingValue', true));
      });

    happyPathDotEnvTest
      .commandWithContext((ctx) => ['ssm:import', '--from-dotenv', ctx.dotenvFilename, '--prefix', ctx.prefix])
      .it('should not allow missing values', (ctx) => {
        Sinon.assert.callCount(ctx.configFile.setParamConfig, Object.keys(ctx.jsonConfig).length);
        Sinon.assert.alwaysCalledWith(ctx.configFile.setParamConfig, Source.SSM, Sinon.match.string, Sinon.match.has('allowMissingValue', undefined));
      });
  });
})
