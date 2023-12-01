import { stdin } from 'mock-stdin';

import test from '../helpers/register';
import { randomUUID } from 'crypto';
import { expect } from 'chai';
import clearSSM from '../helpers/clear-ssm';
import resetConfig from '../helpers/reset-config';
import clearTestScriptOutput from '../helpers/clear-test-script-output';
import { readFile, rm, stat, unlink, writeFile } from 'fs/promises';
import addParam from '../helpers/add-param';
import { ParameterType } from '@aws-sdk/client-ssm';
import { ConfigFile, Source } from '../../src/config';
import EnvFile from '../../src/utils/envfile';
import { resolve } from 'path';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SSM', () => {
  const ssmTest = test
    .do(() => clearSSM())
    .setEnv('AWS_REGION', 'us-east-1')
    .setEnv('AWS_ACCESS_KEY_ID', 'abc')
    .setEnv('AWS_SECRET_ACCESS_KEY', '123')
    .stdout()
    .stderr()
    .add('stdin', () => stdin())
    .add('env', 'test')
    .finally((ctx) => ctx.stdin.restore())
    .finally(() => resetConfig())
    .finally(() => clearTestScriptOutput())
    .finally(() => clearSSM());

  ssmTest
    .add('paramName', () => '/test/var')
    .add('paramValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.paramName, '--value', ctx.paramValue])
    .commandWithContext((ctx) => ['ssm:read', '--env', 'test', '--name', ctx.paramName, '--quiet'])
    .do((ctx) => expect(ctx.stdout).to.match(new RegExp(`^${ctx.paramValue}$`, 'm')))
    .add('updatedParamValue', () => randomUUID())
    .commandWithContext((ctx) => ['ssm:update', '--env', 'test', '--name', ctx.paramName, '--value', ctx.updatedParamValue])
    .commandWithContext((ctx) => ['ssm:read', '--env', 'test', '--name', ctx.paramName, '--quiet'])
    .do((ctx) => expect(ctx.stdout).to.match(new RegExp(`^${ctx.updatedParamValue}$`, 'm')))
    .it('should print the updated value');

  ssmTest
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .add('param2', () => ({ name: '/param/two', envVarName: 'TWO', value: randomUUID() }))
    .add('param3', () => ({ name: '/param/three', envVarName: 'THREE', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param2.name, '--env-var-name', ctx.param2.envVarName, '--value', ctx.param2.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param3.name, '--env-var-name', ctx.param3.envVarName, '--value', ctx.param3.value])
    .command(['export', '--env', 'test', '--format', 'dotenv'])
    .it('should export to dotenv format', (ctx) => {
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param1.envVarName}=${ctx.param1.value}$`, 'm'));
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param2.envVarName}=${ctx.param2.value}$`, 'm'));
      expect(ctx.stdout).to.match(new RegExp(`^${ctx.param3.envVarName}=${ctx.param3.value}$`, 'm'));
    })

  ssmTest
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .add('param2', () => ({ name: '/param/two', envVarName: 'TWO', value: randomUUID() }))
    .add('param3', () => ({ name: '/param/three', envVarName: 'THREE', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param2.name, '--env-var-name', ctx.param2.envVarName, '--value', ctx.param2.value])
    .commandWithContext((ctx) => ['ssm:create', '--env', 'test', '--name', ctx.param3.name, '--env-var-name', ctx.param3.envVarName, '--value', ctx.param3.value])
    .commandWithContext((ctx) => ['exec', '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', `--name=${ctx.param1.envVarName}`, ctx.param2.envVarName, `--name=${ctx.param3.envVarName}`])
    .it('should execute the command', async (ctx) => {
      // This isn't great, but I can't find a way to guarantee the shell script has finished writing
      // to the file by now.
      await sleep(5_000)

      const output = (await readFile('./test-script-output.txt')).toString();

      expect(output).to.match(new RegExp(`^${ctx.param1.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param2.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param3.value}$`, 'm'));
    })

  ssmTest
    .add('cwd', () => './cwd_test')
    .finally((ctx) => rm(resolve(process.cwd(), ctx.cwd), { recursive: true }))
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--cwd', ctx.cwd, '--env', ctx.env, '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['exec', '--cwd', ctx.cwd, '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', `--name=${ctx.param1.envVarName}`])
    .it('should save the config to the config file in the cwd directory', async (ctx) => {
      await sleep(5_000);

      const dirStats = await stat(resolve(process.cwd(), ctx.cwd));
      expect(dirStats.isDirectory()).to.equal(true);

      const fileStats = await stat(resolve(process.cwd(), ctx.cwd, `.griffin-config.${ctx.env}.json`));
      expect(fileStats.isFile()).to.equal(true);

      const output = (await readFile('./test-script-output.txt')).toString();
      expect(output).to.match(new RegExp(`^${ctx.param1.value}$`, 'm'));
    });

  ssmTest
    .add('cwd', () => './cwd_test')
    .finally((ctx) => rm(resolve(process.cwd(), ctx.cwd), { recursive: true }))
    .add('param1', () => ({ name: '/param/one', envVarName: 'ONE', value: randomUUID() }))
    .add('param2', () => ({ name: '/param/two', envVarName: 'TWO', value: randomUUID() }))
    .commandWithContext((ctx) => ['ssm:create', '--cwd', ctx.cwd, '--env', ctx.env, '--name', ctx.param1.name, '--env-var-name', ctx.param1.envVarName, '--value', ctx.param1.value])
    .commandWithContext((ctx) => ['ssm:create', '--cwd', ctx.cwd, '--env', ctx.env, '--name', ctx.param2.name, '--env-var-name', ctx.param2.envVarName, '--value', ctx.param2.value])
    .commandWithContext((ctx) => ['exec', '--cwd', ctx.cwd, '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', `--name=${ctx.param1.envVarName}`, ctx.param2.envVarName])
    .it('should not throw an error if the directory already exists', async (ctx) => {
      await sleep(5_000);

      const dirStats = await stat(resolve(process.cwd(), ctx.cwd));
      expect(dirStats.isDirectory()).to.equal(true);

      const fileStats = await stat(resolve(process.cwd(), ctx.cwd, `.griffin-config.${ctx.env}.json`));
      expect(fileStats.isFile()).to.equal(true);

      const output = (await readFile('./test-script-output.txt')).toString();
      expect(output).to.match(new RegExp(`^${ctx.param1.value}$`, 'm'));
      expect(output).to.match(new RegExp(`^${ctx.param2.value}$`, 'm'));
    });

  describe('import', () => {
    describe('dotenv', () => {
      const dotEnvImportTest = ssmTest
        .add('filename', () => `test-${randomUUID()}.env`)
        .finally(async (ctx) => {
          try {
            await unlink(ctx.filename)
          } catch (err) {
            // Ignore an error here...
          }
        })
        .add('prefix', () => `/griffin-test/${randomUUID()}`)
        .add('params', () => ({
          URL: 'https://www.google.com/?q=recursion',
          MULTILINE_ESCAPED: 'line1\\nline2\\nline3',
          BOOL: 'true',
          NUMBER: '42',
        }))
        .do(async (ctx) => writeFile(ctx.filename, EnvFile.stringify(ctx.params)));

      dotEnvImportTest
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', ctx.prefix])
        .commandWithContext(() => ['exec', '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', 'URL', 'MULTILINE_ESCAPED', 'BOOL', 'NUMBER'])
        .it('should import dotenv files', async (ctx) => {
          await sleep(5_000);

          const output = (await readFile('./test-script-output.txt')).toString();

          expect(output.trim()).to.equal(`${ctx.params.URL}
${ctx.params.MULTILINE_ESCAPED}
${ctx.params.BOOL}
${ctx.params.NUMBER}`);
        });

      dotEnvImportTest
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', ctx.prefix])
        .it('should lock the versions', async (ctx) => {
          const configFile = await ConfigFile.loadConfig('test');

          Object.keys(ctx.params).forEach((paramName) => {
            expect(configFile.getParamConfig(Source.SSM, `${ctx.prefix}/${paramName}`)?.version).to.equal('1');
          });
        });

      dotEnvImportTest
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', ctx.prefix.replace(/^\//, '')])
        .it('should work if the prefix does not start with a slash', async (ctx) => {
          const configFile = await ConfigFile.loadConfig('test');

          Object.keys(ctx.params).forEach((paramName) => {
            expect(configFile.getParamConfig(Source.SSM, `${ctx.prefix}/${paramName}`)).to.exist;
          });
        });

      dotEnvImportTest
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', `${ctx.prefix}/`])
        .it('should work if the prefix ends with a slash', async (ctx) => {
          const configFile = await ConfigFile.loadConfig('test');

          Object.keys(ctx.params).forEach((paramName) => {
            expect(configFile.getParamConfig(Source.SSM, `${ctx.prefix}/${paramName}`)).to.exist;
          });
        });

      dotEnvImportTest
        .do((ctx) => addParam({
          name: `${ctx.prefix}/URL`,
          value: 'https://bing.com/',
        }))
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', ctx.prefix])
        .it('should not fail if a parameter already exists', (ctx) => {
          expect(ctx.stderr).to.include('Failed to import');
        });

      dotEnvImportTest
        .add('overwrittenParam', (ctx) => `${ctx.prefix}/URL`)
        .do((ctx) => addParam({
          name: ctx.overwrittenParam,
          value: 'https://bing.com/',
        }))
        .commandWithContext((ctx) => ['ssm:import', '--env', 'test', '--from-dotenv', ctx.filename, '--prefix', ctx.prefix, '--overwrite'])
        .commandWithContext(() => ['exec', '--env', 'test', '--skip-exit', '--', './test/integration/test-script.sh', 'URL'])
        .it('should overwrite parameters if the overwrite flag is provided', async (ctx) => {
          const configFile = await ConfigFile.loadConfig('test');

          expect(configFile.getParamConfig(Source.SSM, ctx.overwrittenParam)?.version).to.equal('2');

          await sleep(5000);

          const output = (await readFile('./test-script-output.txt')).toString();
          expect(output.trim()).to.equal(ctx.params.URL);
        });
    });

    describe('chamber', () => {
      const chamberImportTest = ssmTest
        .add('serviceName', 'griffin-cli')
        .add('serviceEnvName', 'griffin-cli-test')
        .add('params', (ctx) => [
          { name: `/${ctx.serviceName}/param-one`, value: randomUUID() },
          { name: `/${ctx.serviceName}/param-two`, value: randomUUID() },
          { name: `/${ctx.serviceEnvName}/param-three`, value: randomUUID() },
          { name: `/${ctx.serviceEnvName}/param-one`, value: randomUUID() },
        ])
        .do((ctx) => Promise.all(ctx.params.map((param) => addParam({
          name: param.name,
          value: param.value,
          type: ParameterType.SECURE_STRING,
        }))));

      chamberImportTest
        .commandWithContext((ctx) => ['ssm:import', '-c', ctx.serviceName, '-c', ctx.serviceEnvName])
        .do((ctx) => addParam({
          name: ctx.params[2].name,
          value: randomUUID(),
        }))
        .commandWithContext(() => ['exec', '--skip-exit', '--', './test/integration/test-script.sh', `--name=PARAM_ONE`, 'PARAM_TWO', `--name=PARAM_THREE`])
        .it('should import chamber params and lock the version', async (ctx) => {
          // This isn't great, but I can't find a way to guarantee the shell script has finished writing
          // to the file by now.
          await sleep(5_000)

          const output = (await readFile('./test-script-output.txt')).toString();

          expect(output).to.match(new RegExp(`^${ctx.params[1].value}$`, 'm'));
          expect(output).to.match(new RegExp(`^${ctx.params[2].value}$`, 'm'));
          expect(output).to.match(new RegExp(`^${ctx.params[3].value}$`, 'm'));
        })

      chamberImportTest
        .add('updatedParamValue', randomUUID())
        .commandWithContext((ctx) => ['ssm:import', '-c', ctx.serviceName, '-c', ctx.serviceEnvName, '--always-use-latest', '--allow-missing-value'])
        .do((ctx) => addParam({
          name: ctx.params[2].name,
          value: ctx.updatedParamValue,
        }))
        .commandWithContext(() => ['exec', '--skip-exit', '--', './test/integration/test-script.sh', `--name=PARAM_ONE`, 'PARAM_TWO', `--name=PARAM_THREE`])
        .it('should import chamber params without locking the version', async (ctx) => {
          // This isn't great, but I can't find a way to guarantee the shell script has finished writing
          // to the file by now.
          await sleep(5_000)

          const output = (await readFile('./test-script-output.txt')).toString();

          expect(output).to.match(new RegExp(`^${ctx.params[1].value}$`, 'm'));
          expect(output).to.match(new RegExp(`^${ctx.params[3].value}$`, 'm'));

          expect(output).to.match(new RegExp(`^${ctx.updatedParamValue}$`, 'm'));
        });
    });
  });
});
