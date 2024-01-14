import { expect, test } from '@oclif/test';
import { mockClient } from 'aws-sdk-client-mock';

import { DeleteParameterCommand, GetParameterCommand, GetParameterHistoryCommand, GetParametersCommand, ParameterHistory, ParameterNotFound, ParameterType, ParameterVersionNotFound, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { randomUUID } from 'crypto';
import sinon from 'sinon';
import { MissingRequiredParamError, ParameterNotFoundError, ParameterVersionNotFoundError } from '../../src/errors';
import SSMStore from '../../src/store/ssm-store';
import ParamDefinition from '../../src/types/param-definition';

describe('SSMStore', () => {
  describe('Static Methods', () => {
    describe('getEnvVarNameFromParamName', () => {
      test.it('should work with a param without a prefix', () => {
        expect(SSMStore.getEnvVarNameFromParamName('/test')).to.equal('TEST');
      });

      test.it('should work with a name with a prefix', () => {
        expect(SSMStore.getEnvVarNameFromParamName('/prefix/subprefix/test')).to.equal('TEST');
      });
    });
  });

  describe('Instance Methods', () => {
    let count = 0

    const ssmStoreTest = test
      .add('ssmClient', () => mockClient(SSMClient))
      .finally((ctx) => ctx.ssmClient.restore())
      .add('store', (ctx) => new SSMStore(ctx.ssmClient as unknown as SSMClient))
      .add('paramName', () => `/griffin/test/ssmstore/${count++}`)

    const createRandomRecord = (
      ctx: { paramName: string, paramVersion?: number },
      {
        type = 'SecureString',
        value = randomUUID(),
        version = Math.max(Math.floor(Math.random() * ((ctx.paramVersion ?? 100) - 1)), 1),
      }: {
        type?: ParameterType,
        value?: string,
        version?: number,
      } = {}
    ): ParameterHistory => ({
      Name: ctx.paramName,
      Type: type,
      Value: value,
      Version: version,
      LastModifiedDate: new Date(Date.now() - Math.floor(Math.random() * 3.15576e+10)),
      LastModifiedUser: 'c1moore',
    });

    const createRandomRecords = (ctx: { paramName: string, paramVersion?: number }, count: number): ParameterHistory[] => {
      const records: ParameterHistory[] = [];
      for (let i = 0; i < count; i++) {
        records.push(createRandomRecord(ctx));
      }

      return records;
    };

    describe('delete', () => {
      ssmStoreTest
        .do((ctx) => {
          ctx.ssmClient.on(DeleteParameterCommand).resolves({});
        })
        .do((ctx) => ctx.store.delete(ctx.paramName))
        .do((ctx) => {
          sinon.assert.calledOnce(ctx.ssmClient.send)
          expect(ctx.ssmClient.commandCalls(DeleteParameterCommand, {
            Name: ctx.paramName,
          })).to.exist.and.have.length(1);
        })
        .it('should delete the parameter');

      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(DeleteParameterCommand).rejects(new ParameterNotFound({
          $metadata: {},
          message: '',
        })))
        .do((ctx) => ctx.store.delete(ctx.paramName))
        .do((ctx) => {
          sinon.assert.calledOnce(ctx.ssmClient.send)
          expect(ctx.ssmClient.commandCalls(DeleteParameterCommand, {
            Name: ctx.paramName,
          })).to.exist.and.have.length(1);
        })
        .it('should not fail if the parameter does not exist')

      ssmStoreTest
        .add('errorMsg', 'A different type of error.')
        .do((ctx) => ctx.ssmClient.on(DeleteParameterCommand).rejects(ctx.errorMsg))
        .it('should rethrow the original error if the error is not a ParameterNotFound exception', async (ctx) => {
          await expect(ctx.store.delete(ctx.paramName)).to.be.rejectedWith(ctx.errorMsg);

          sinon.assert.calledOnce(ctx.ssmClient.send);
        });
    });

    describe('getEnvVars', () => {
      ssmStoreTest
        .add('envVarName', 'ENV_VAR')
        .add('paramValue', 'value')
        .add('paramDefinitions', (ctx) => [{
          id: ctx.paramName,
          envVarName: ctx.envVarName,
        }] as ParamDefinition[])
        .do(ctx => ctx.ssmClient.on(
          GetParametersCommand,
          {
            Names: [ctx.paramName],
            WithDecryption: true,
          },
        ).resolves({
          Parameters: [{
            Name: ctx.paramName,
            Value: ctx.paramValue,
          }],
        }))
        .do(ctx => expect(ctx.store.getEnvVars(ctx.paramDefinitions)).to.eventually.deep.equal([{
          name: ctx.envVarName,
          value: ctx.paramValue,
        }]))
        .it('should return the key/value pair populated correctly');

      ssmStoreTest
        .add('envVarName', 'ENV_VAR')
        .add('paramValue', 'value')
        .add('paramVersion', '5')
        .do(ctx => ctx.ssmClient.on(
          GetParametersCommand,
          {
            Names: [`${ctx.paramName}:${ctx.paramVersion}`],
            WithDecryption: true,
          },
        ).resolves({
          Parameters: [{
            Name: ctx.paramName,
            Value: ctx.paramValue,
          }]
        }))
        .do(ctx => expect(ctx.store.getEnvVars([{
          id: ctx.paramName,
          version: ctx.paramVersion,
          envVarName: ctx.envVarName,
        }])))
        .it('should fetch the version');

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(
          GetParametersCommand,
        ).callsFake((cmd) => ({
          Parameters: cmd.Names.map((name: string) => ({
            Name: name,
            Value: randomUUID(),
          }))
        })))
        .do(ctx => expect(ctx.store.getEnvVars([
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
          '11',
          '12',
          '13',
          '14',
          '15',
        ].map((i) => ({
          id: `/${i}`,
          envVarName: `VAR${i}`,
        })))).to.eventually.have.length(15))
        .do(ctx => sinon.assert.calledTwice(ctx.ssmClient.send))
        .it('should send the request in batches')

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(
          GetParametersCommand,
          {
            Names: [ctx.paramName],
          },
        ).resolves({
          InvalidParameters: [ctx.paramName],
        }))
        .do(ctx => expect(ctx.store.getEnvVars([{
          id: ctx.paramName,
          envVarName: 'ENV_VAR',
          allowMissingValue: true,
        }])).to.eventually.deep.equal([]))
        .it('should not throw an error if an optional parameter is missing');

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(
          GetParametersCommand,
          {
            Names: [ctx.paramName],
          },
        ).resolves({
          InvalidParameters: [ctx.paramName],
        }))
        .do(ctx => expect(ctx.store.getEnvVars([{
          id: ctx.paramName,
          envVarName: 'ENV_VAR',
        }])).to.be.rejectedWith(MissingRequiredParamError))
        .it('should throw an error if a required parameter is missing');
    });

    describe('getHistory', () => {
      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(GetParameterHistoryCommand).resolves({}))
        .it('should return an empty array if there are no parameters in the response', async (ctx) => expect(ctx.store.getHistory(ctx.paramName)).to.eventually.deep.equal([]));

      ssmStoreTest
        .add('count', 50)
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: ctx.count,
            NextToken: undefined,
          },
        ).resolves({
          Parameters: createRandomRecords(ctx, 50),
        }))
        .do(async (ctx) => {
          const res = await ctx.store.getHistory(ctx.paramName);

          expect(res).to.have.length(ctx.count);

          let prevVersion = Infinity;
          res.forEach((record) => {
            expect(record.version).to.exist;

            const version = parseInt(record.version!, 10);
            expect(version).to.be.lessThanOrEqual(prevVersion);
            prevVersion = version;
          });
        })
        .do(ctx => sinon.assert.calledOnce(ctx.ssmClient.send))
        .it('should return the history of the parameter sorted by most recent first')

      ssmStoreTest
        .add('count', 100)
        .add('nextToken', randomUUID())
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: ctx.nextToken,
          },
        ).resolves({
          Parameters: createRandomRecords(ctx, 50),
        }))
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          },
        ).resolves({
          NextToken: ctx.nextToken,
          Parameters: createRandomRecords(ctx, 50),
        }))
        .do(async (ctx) => {
          const res = await ctx.store.getHistory(ctx.paramName);

          expect(res).to.have.length(ctx.count);

          let prevVersion = Infinity;
          res.forEach((record) => {
            expect(record.version).to.exist;

            const version = parseInt(record.version!, 10);
            expect(version).to.be.lessThanOrEqual(prevVersion);
            prevVersion = version;
          });
        })
        .do(ctx => sinon.assert.calledTwice(ctx.ssmClient.send))
        .it('should return the full history if the results are paginated')

      ssmStoreTest
        .add('count', 5)
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: ctx.count,
            NextToken: undefined,
          },
        ).resolves({
          Parameters: createRandomRecords(ctx, 5),
        }))
        .do((ctx) => expect(ctx.store.getHistory(ctx.paramName, ctx.count)).to.eventually.have.length(ctx.count))
        .do(ctx => sinon.assert.calledOnce(ctx.ssmClient.send))
        .it('should only return the number of records requested');

      ssmStoreTest
        .add('count', 55)
        .add('nextToken', randomUUID())
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: 5,
            NextToken: ctx.nextToken,
          },
        ).resolves({
          Parameters: createRandomRecords(ctx, ctx.count - 50),
        }))
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          },
        ).resolves({
          Parameters: createRandomRecords(ctx, 50),
          NextToken: ctx.nextToken,
        }))
        .do(ctx => expect(ctx.store.getHistory(ctx.paramName, ctx.count)).to.eventually.have.length(55))
        .do(ctx => sinon.assert.calledTwice(ctx.ssmClient.send))
        .it('should return as many records as specified if more than the batch size is requested');
    });

    describe('getCurrentVersion', () => {
      ssmStoreTest
        .add('currentVersion', () => 5)
        .do(ctx => ctx.ssmClient.on(GetParameterCommand).resolves({
          Parameter: {
            Version: ctx.currentVersion,
          },
        }))
        .do(ctx => expect(ctx.store.getCurrentVersion(ctx.paramName)).to.eventually.equal(`${ctx.currentVersion}`))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(GetParameterCommand, {
            Name: ctx.paramName,
          })).to.exist.and.have.length(1);
        })
        .it('should return the current version')

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(GetParameterCommand, {
          Name: ctx.paramName,
        }).rejects(new ParameterNotFound({
          $metadata: {},
          message: '',
        })))
        .do(ctx => expect(ctx.store.getCurrentVersion(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError))
        .it('should throw a ParameterNotFoundError if the parameter could not be found')

      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand, {
          Name: ctx.paramName,
        }).resolves({
          Parameter: {},
        }))
        .it('should throw a ParameterNotFoundError if the version is not set', async (ctx) => {
          await expect(ctx.store.getCurrentVersion(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError);
        });

      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand).resolves({}))
        .it('should throw a ParameterNotFoundError if the parameter is not set', async (ctx) => {
          await expect(ctx.store.getCurrentVersion(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError);
        });

      ssmStoreTest
        .add('errorMsg', 'Something bad happened.')
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand).rejects(ctx.errorMsg))
        .it('should rethrow an unknown error', async (ctx) => expect(ctx.store.getCurrentVersion(ctx.paramName)).to.be.rejectedWith(ctx.errorMsg));
    });

    describe('getParamRecord', () => {
      const paramRecordTest = ssmStoreTest
        .add('paramVersion', () => 55)
        .add('paramHistory', (ctx) => createRandomRecord(ctx, {
          version: ctx.paramVersion,
        }))
        .add('paramRecord', (ctx) => ({
          name: ctx.paramName,
          value: ctx.paramHistory.Value,
          version: `${ctx.paramVersion}`,
          modifiedAt: ctx.paramHistory.LastModifiedDate,
          modifiedBy: ctx.paramHistory.LastModifiedUser,
        }));

      paramRecordTest
        .do(ctx => ctx.ssmClient.on(GetParameterHistoryCommand).resolves({
          Parameters: [
            ...createRandomRecords(ctx, 3),
            ctx.paramHistory,
            ...createRandomRecords(ctx, 4),
          ]
        }))
        .do((ctx) => expect(ctx.store.getParamRecord(ctx.paramName, `${ctx.paramVersion}`)).to.eventually.deep.equal(ctx.paramRecord))
        .do((ctx) => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(GetParameterHistoryCommand, {
            Name: ctx.paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          })).to.exist.and.have.length(1);
        })
        .it('should return the parameter record for the specified version');

      paramRecordTest
        .do(ctx => ctx.ssmClient.on(GetParameterHistoryCommand).resolves({
          NextToken: randomUUID(),
          Parameters: [
            ...createRandomRecords(ctx, 3),
            ctx.paramHistory,
            ...createRandomRecords(ctx, 4),
          ]
        }))
        .do((ctx) => expect(ctx.store.getParamRecord(ctx.paramName, `${ctx.paramVersion}`)).to.eventually.deep.equal(ctx.paramRecord))
        .do((ctx) => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
        })
        .it('should not pull more records if it found the proper version');

      paramRecordTest
        .add('nextToken', randomUUID())
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            NextToken: ctx.nextToken,
          },
        ).resolves({
          NextToken: undefined,
          Parameters: [
            ...createRandomRecords(ctx, 4),
            ctx.paramHistory,
          ],
        }))
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
            NextToken: undefined,
          },
        ).resolves({
          NextToken: ctx.nextToken,
          Parameters: createRandomRecords(ctx, 50),
        }))
        .do((ctx) => expect(ctx.store.getParamRecord(ctx.paramName, `${ctx.paramVersion}`)).to.eventually.deep.equal(ctx.paramRecord))
        .do((ctx) => {
          sinon.assert.calledTwice(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(GetParameterHistoryCommand, {
            Name: ctx.paramName,
            NextToken: ctx.nextToken,
          }));
        })
        .it('should continue fetching records until it finds the desired version');

      paramRecordTest
        .do(ctx => ctx.ssmClient.on(
          GetParameterHistoryCommand,
          {
            Name: ctx.paramName,
          },
        ).resolves({
          NextToken: undefined,
          Parameters: createRandomRecords(ctx, 10),
        }))
        .do(ctx => expect(ctx.store.getParamRecord(ctx.paramName, `${ctx.paramVersion}`)).to.be.rejectedWith(ParameterVersionNotFoundError))
        .it('should throw a ParameterVersionNotFoundError if the version could not be found');
    });

    describe('getParamValue', () => {
      ssmStoreTest
        .add('paramValue', () => `${count}`)
        .do(ctx => ctx.ssmClient.on(GetParameterCommand, {
          Name: ctx.paramName,
          WithDecryption: true,
        }).resolves({
          Parameter: {
            Value: ctx.paramValue,
          },
        }))
        .do(ctx => expect(ctx.store.getParamValue(ctx.paramName)).to.eventually.equal(ctx.paramValue))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(GetParameterCommand, {
            Name: ctx.paramName,
            WithDecryption: true,
          })).to.exist.and.have.length(1);
        })
        .it('should return the parameter')

      ssmStoreTest
        .add('paramValue', () => `${count}`)
        .add('paramVersion', () => count + 1)
        .add('ssmName', (ctx) => `${ctx.paramName}:${ctx.paramVersion}`)
        .do(ctx => ctx.ssmClient.on(GetParameterCommand, {
          Name: ctx.ssmName,
          WithDecryption: true
        }).resolves({
          Parameter: {
            Value: ctx.paramValue,
          },
        }))
        .do(ctx => expect(ctx.store.getParamValue(ctx.paramName, `${ctx.paramVersion}`)).to.eventually.equal(ctx.paramValue))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(GetParameterCommand, {
            Name: ctx.ssmName,
            WithDecryption: true,
          })).to.exist.and.have.length(1);
        })
        .it('should return the parameter using the right version')

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(GetParameterCommand).rejects(new ParameterNotFound({
          $metadata: {},
          message: '',
        })))
        .do(ctx => expect(ctx.store.getParamValue(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError))
        .it('should throw a ParameterNotFoundError if the parameter does not exist');

      ssmStoreTest
        .do(ctx => ctx.ssmClient.on(GetParameterCommand).rejects(new ParameterVersionNotFound({
          $metadata: {},
          message: '',
        })))
        .do(ctx => expect(ctx.store.getParamValue(ctx.paramName)).to.be.rejectedWith(ParameterVersionNotFoundError))
        .it('should throw a ParameterVersionNotFoundError if the parameter version does not exist');

      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand, {
          Name: ctx.paramName,
        }).resolves({
          Parameter: {},
        }))
        .it('should throw a ParameterNotFoundError if the version is not set', async (ctx) => {
          await expect(ctx.store.getParamValue(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError);
        });

      ssmStoreTest
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand).resolves({}))
        .it('should throw a ParameterNotFoundError if the parameter is not set', async (ctx) => {
          await expect(ctx.store.getParamValue(ctx.paramName)).to.be.rejectedWith(ParameterNotFoundError);
        });

      ssmStoreTest
        .add('errorMsg', 'Something bad happened.')
        .do((ctx) => ctx.ssmClient.on(GetParameterCommand).rejects(ctx.errorMsg))
        .it('should rethrow an unknown error', async (ctx) => expect(ctx.store.getParamValue(ctx.paramName)).to.be.rejectedWith(ctx.errorMsg));
    });

    describe('writeParam', () => {
      const writeParamTest = ssmStoreTest
        .add('paramValue', () => `${count}`)
        .add('nextVersion', () => count + 1);

      writeParamTest
        .do(ctx => ctx.ssmClient.on(PutParameterCommand, {
          Name: ctx.paramName,
          Value: ctx.paramValue,
        }).resolves({
          Version: ctx.nextVersion,
        }))
        .do(ctx => expect(ctx.store.writeParam({
          name: ctx.paramName,
          value: ctx.paramValue,
        })).to.eventually.deep.equal({
          updatedVersion: `${ctx.nextVersion}`,
        }))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(PutParameterCommand, {
            Name: ctx.paramName,
            Value: ctx.paramValue,
          })).to.exist.and.have.length(1);
        })
        .it('should update the value and return the updated version')

      writeParamTest
        .add('paramDescription', () => 'This is a parameter in SSM.')
        .do(ctx => ctx.ssmClient.on(PutParameterCommand, {
          Name: ctx.paramName,
          Value: ctx.paramValue,
          Description: ctx.paramDescription,
        }).resolves({
          Version: ctx.nextVersion,
        }))
        .do(ctx => expect(ctx.store.writeParam({
          name: ctx.paramName,
          value: ctx.paramValue,
          description: ctx.paramDescription,
        })).to.eventually.deep.equal({
          updatedVersion: `${ctx.nextVersion}`,
        }))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(PutParameterCommand, {
            Name: ctx.paramName,
            Value: ctx.paramValue,
            Description: ctx.paramDescription,
          })).to.exist.and.have.length(1);
        })
        .it('should update the value and set the description')

      writeParamTest
        .add('paramType', (): ParameterType => 'SecureString')
        .do(ctx => ctx.ssmClient.on(PutParameterCommand, {
          Name: ctx.paramName,
          Value: ctx.paramValue,
          Type: ctx.paramType,
        }).resolves({
          Version: ctx.nextVersion,
        }))
        .do(ctx => expect(ctx.store.writeParam({
          name: ctx.paramName,
          value: ctx.paramValue,
          type: ctx.paramType,
        })).to.eventually.deep.equal({
          updatedVersion: `${ctx.nextVersion}`,
        }))
        .do(ctx => {
          sinon.assert.calledOnce(ctx.ssmClient.send);
          expect(ctx.ssmClient.commandCalls(PutParameterCommand, {
            Name: ctx.paramName,
            Value: ctx.paramValue,
            Type: ctx.paramType,
          })).to.exist.and.have.length(1);
        })
        .it('should update the value and set the parameter type')
    });
  });
})