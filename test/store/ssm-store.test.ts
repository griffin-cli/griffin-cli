import { expect } from "chai";
import sinon, { SinonSandbox } from "sinon";
import { mockClient, AwsClientStub } from "aws-sdk-client-mock";
import {
  DeleteParameterCommand,
  GetParameterCommand,
  GetParameterHistoryCommand,
  GetParametersCommand,
  ParameterHistory,
  ParameterNotFound,
  ParameterType,
  ParameterVersionNotFound,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { randomUUID } from "crypto";

import {
  MissingRequiredParamError,
  ParameterNotFoundError,
  ParameterVersionNotFoundError,
} from "../../src/errors/index.js";
import SSMStore from "../../src/store/ssm-store.js";
import type { ParamDefinition } from "../../src/types/param-definition.js";

describe("SSMStore", () => {
  describe("Static Methods", () => {
    describe("getEnvVarNameFromParamName", () => {
      it("should work with a param without a prefix", () => {
        expect(SSMStore.getEnvVarNameFromParamName("/test")).to.equal("TEST");
      });

      it("should work with a name with a prefix", () => {
        expect(
          SSMStore.getEnvVarNameFromParamName("/prefix/subprefix/test")
        ).to.equal("TEST");
      });
    });
  });

  describe("Instance Methods", () => {
    let ssmClient: AwsClientStub<SSMClient>;
    let store: SSMStore;
    let paramName: string;
    let count = 0;

    const createRandomRecord = (
      ctx: { paramName: string; paramVersion?: number },
      {
        type = "SecureString",
        value = randomUUID(),
        version = Math.max(
          Math.floor(Math.random() * ((ctx.paramVersion ?? 100) - 1)),
          1
        ),
      }: {
        type?: ParameterType;
        value?: string;
        version?: number;
      } = {}
    ): ParameterHistory => ({
      Name: ctx.paramName,
      Type: type,
      Value: value,
      Version: version,
      LastModifiedDate: new Date(
        Date.now() - Math.floor(Math.random() * 3.15576e10)
      ),
      LastModifiedUser: "c1moore",
    });

    const createRandomRecords = (
      ctx: { paramName: string; paramVersion?: number },
      recordCount: number
    ): ParameterHistory[] => {
      const records: ParameterHistory[] = [];
      for (let i = 0; i < recordCount; i++) {
        records.push(createRandomRecord(ctx));
      }
      return records;
    };

    beforeEach(() => {
      ssmClient = mockClient(SSMClient);
      store = new SSMStore(ssmClient as unknown as SSMClient);
      paramName = `/griffin/test/ssmstore/${count++}`;
    });

    afterEach(() => {
      ssmClient.restore();
    });

    describe("delete", () => {
      it("should delete the parameter", async () => {
        ssmClient.on(DeleteParameterCommand).resolves({});

        await store.delete(paramName);

        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(DeleteParameterCommand, { Name: paramName })
        ).to.have.length(1);
      });

      it("should not fail if the parameter does not exist", async () => {
        ssmClient
          .on(DeleteParameterCommand)
          .rejects(new ParameterNotFound({ $metadata: {}, message: "" }));

        await store.delete(paramName);

        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(DeleteParameterCommand, { Name: paramName })
        ).to.exist.and.have.length(1);
      });

      it("should rethrow the original error if the error is not a ParameterNotFound exception", async () => {
        const errorMsg = "A different type of error.";
        ssmClient.on(DeleteParameterCommand).rejects(errorMsg);

        await expect(store.delete(paramName)).to.be.rejectedWith(errorMsg);
      });
    });

    describe("getEnvVars", () => {
      it("should return the key/value pair populated correctly", async () => {
        const envVarName = "ENV_VAR";
        const paramValue = "value";
        ssmClient
          .on(GetParametersCommand, {
            Names: [paramName],
            WithDecryption: true,
          })
          .resolves({
            Parameters: [{ Name: paramName, Value: paramValue }],
          });

        const result = await store.getEnvVars([
          { id: paramName, envVarName },
        ] as ParamDefinition[]);

        expect(result).to.deep.equal([{ name: envVarName, value: paramValue }]);
      });

      it("should fetch the version", async () => {
        const envVarName = "ENV_VAR";
        const paramValue = "value";
        const paramVersion = "5";
        ssmClient
          .on(GetParametersCommand, {
            Names: [`${paramName}:${paramVersion}`],
            WithDecryption: true,
          })
          .resolves({
            Parameters: [{ Name: paramName, Value: paramValue }],
          });

        const result = await store.getEnvVars([
          { id: paramName, version: paramVersion, envVarName },
        ] as ParamDefinition[]);

        expect(result).to.deep.equal([{ name: envVarName, value: paramValue }]);
      });

      it("should send the request in batches", async () => {
        ssmClient.on(GetParametersCommand).callsFake((cmd) => ({
          Parameters: cmd.Names.map((name: string) => ({
            Name: name,
            Value: randomUUID(),
          })),
        }));

        const params = Array.from({ length: 15 }, (_, i) => ({
          id: `/${i + 1}`,
          envVarName: `VAR${i + 1}`,
        }));

        const result = await store.getEnvVars(params as ParamDefinition[]);

        expect(result).to.have.length(15);
        sinon.assert.calledTwice(ssmClient.send);
      });

      it("should not throw an error if an optional parameter is missing", async () => {
        ssmClient.on(GetParametersCommand, { Names: [paramName] }).resolves({
          InvalidParameters: [paramName],
        });

        const result = await store.getEnvVars([
          { id: paramName, envVarName: "ENV_VAR", allowMissingValue: true },
        ] as ParamDefinition[]);

        expect(result).to.deep.equal([]);
      });

      it("should throw an error if a required parameter is missing", async () => {
        ssmClient.on(GetParametersCommand, { Names: [paramName] }).resolves({
          InvalidParameters: [paramName],
        });

        await expect(
          store.getEnvVars([
            { id: paramName, envVarName: "ENV_VAR" },
          ] as ParamDefinition[])
        ).to.be.rejectedWith(MissingRequiredParamError);
      });
    });

    describe("getHistory", () => {
      it("should return an empty array if there are no parameters in the response", async () => {
        ssmClient.on(GetParameterHistoryCommand).resolves({});

        const result = await store.getHistory(paramName);

        expect(result).to.deep.equal([]);
      });

      it("should return the history of the parameter sorted by most recent first", async () => {
        const records = createRandomRecords({ paramName }, 50);
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          })
          .resolves({ Parameters: records });

        const res = await store.getHistory(paramName);

        expect(res).to.have.length(50);
        let prevVersion = Infinity;
        res.forEach((record) => {
          expect(record.version).to.exist;
          const version = parseInt(record.version!, 10);
          expect(version).to.be.lessThanOrEqual(prevVersion);
          prevVersion = version;
        });
      });

      it("should return the full history if the results are paginated", async () => {
        const nextToken = randomUUID();
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          })
          .resolves({
            NextToken: nextToken,
            Parameters: createRandomRecords({ paramName }, 50),
          });
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: nextToken,
          })
          .resolves({
            Parameters: createRandomRecords({ paramName }, 50),
          });

        const res = await store.getHistory(paramName);

        expect(res).to.have.length(100);
        let prevVersion = Infinity;
        res.forEach((record) => {
          expect(record.version).to.exist;
          const version = parseInt(record.version!, 10);
          expect(version).to.be.lessThanOrEqual(prevVersion);
          prevVersion = version;
        });
        sinon.assert.calledTwice(ssmClient.send);
      });

      it("should only return the number of records requested", async () => {
        const recordCount = 5;
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: recordCount,
            NextToken: undefined,
          })
          .resolves({
            Parameters: createRandomRecords({ paramName }, recordCount),
          });

        const result = await store.getHistory(paramName, recordCount);

        expect(result).to.have.length(recordCount);
        sinon.assert.calledOnce(ssmClient.send);
      });

      it("should return as many records as specified if more than the batch size is requested", async () => {
        const recordCount = 55;
        const nextToken = randomUUID();
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          })
          .resolves({
            NextToken: nextToken,
            Parameters: createRandomRecords({ paramName }, 50),
          });
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 5,
            NextToken: nextToken,
          })
          .resolves({
            Parameters: createRandomRecords({ paramName }, 5),
          });

        const result = await store.getHistory(paramName, recordCount);

        expect(result).to.have.length(55);
        sinon.assert.calledTwice(ssmClient.send);
      });
    });

    describe("getCurrentVersion", () => {
      it("should return the current version", async () => {
        const currentVersion = 5;
        ssmClient
          .on(GetParameterCommand)
          .resolves({ Parameter: { Version: currentVersion } });

        const result = await store.getCurrentVersion(paramName);

        expect(result).to.equal(`${currentVersion}`);
        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(GetParameterCommand, { Name: paramName })
        ).to.exist.and.have.length(1);
      });

      it("should throw a ParameterNotFoundError if the parameter could not be found", async () => {
        ssmClient
          .on(GetParameterCommand, { Name: paramName })
          .rejects(new ParameterNotFound({ $metadata: {}, message: "" }));

        await expect(store.getCurrentVersion(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should throw a ParameterNotFoundError if the version is not set", async () => {
        ssmClient
          .on(GetParameterCommand, { Name: paramName })
          .resolves({ Parameter: {} });

        await expect(store.getCurrentVersion(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should throw a ParameterNotFoundError if the parameter is not set", async () => {
        ssmClient.on(GetParameterCommand).resolves({});

        await expect(store.getCurrentVersion(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should rethrow an unknown error", async () => {
        const errorMsg = "Something bad happened.";
        ssmClient.on(GetParameterCommand).rejects(errorMsg);

        await expect(store.getCurrentVersion(paramName)).to.be.rejectedWith(
          errorMsg
        );
      });
    });

    describe("getParamRecord", () => {
      it("should return the parameter record for the specified version", async () => {
        const paramVersion = 55;
        const paramHistory = createRandomRecord(
          { paramName, paramVersion },
          { version: paramVersion }
        );
        ssmClient.on(GetParameterHistoryCommand).resolves({
          Parameters: [
            ...createRandomRecords({ paramName, paramVersion }, 3),
            paramHistory,
            ...createRandomRecords({ paramName, paramVersion }, 4),
          ],
        });

        const result = await store.getParamRecord(paramName, `${paramVersion}`);

        expect(result).to.deep.equal({
          name: paramName,
          value: paramHistory.Value,
          version: `${paramVersion}`,
          modifiedAt: paramHistory.LastModifiedDate,
          modifiedBy: paramHistory.LastModifiedUser,
        });

        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(GetParameterHistoryCommand, {
            Name: paramName,
            WithDecryption: true,
            MaxResults: 50,
            NextToken: undefined,
          })
        ).to.exist.and.have.length(1);
      });

      it("should not pull more records if it found the proper version", async () => {
        const paramVersion = 55;
        const paramHistory = createRandomRecord(
          { paramName, paramVersion },
          { version: paramVersion }
        );
        ssmClient.on(GetParameterHistoryCommand).resolves({
          NextToken: randomUUID(),
          Parameters: [
            ...createRandomRecords({ paramName, paramVersion }, 3),
            paramHistory,
            ...createRandomRecords({ paramName, paramVersion }, 4),
          ],
        });

        const result = await store.getParamRecord(paramName, `${paramVersion}`);

        expect(result).to.deep.equal({
          name: paramName,
          value: paramHistory.Value,
          version: `${paramVersion}`,
          modifiedAt: paramHistory.LastModifiedDate,
          modifiedBy: paramHistory.LastModifiedUser,
        });
        sinon.assert.calledOnce(ssmClient.send);
      });

      it("should continue fetching records until it finds the desired version", async () => {
        const paramVersion = 55;
        const nextToken = randomUUID();
        const paramHistory = createRandomRecord(
          { paramName, paramVersion },
          { version: paramVersion }
        );
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            NextToken: undefined,
          })
          .resolves({
            NextToken: nextToken,
            Parameters: createRandomRecords({ paramName, paramVersion }, 50),
          });
        ssmClient
          .on(GetParameterHistoryCommand, {
            Name: paramName,
            NextToken: nextToken,
          })
          .resolves({
            NextToken: undefined,
            Parameters: [
              ...createRandomRecords({ paramName, paramVersion }, 4),
              paramHistory,
            ],
          });

        const result = await store.getParamRecord(paramName, `${paramVersion}`);

        expect(result).to.deep.equal({
          name: paramName,
          value: paramHistory.Value,
          version: `${paramVersion}`,
          modifiedAt: paramHistory.LastModifiedDate,
          modifiedBy: paramHistory.LastModifiedUser,
        });
        sinon.assert.calledTwice(ssmClient.send);

        expect(
          ssmClient.commandCalls(GetParameterHistoryCommand, {
            Name: paramName,
            NextToken: nextToken,
          })
        );
      });

      it("should throw a ParameterVersionNotFoundError if the version could not be found", async () => {
        const paramVersion = 55;
        ssmClient.on(GetParameterHistoryCommand, { Name: paramName }).resolves({
          NextToken: undefined,
          Parameters: createRandomRecords({ paramName, paramVersion }, 10),
        });

        await expect(
          store.getParamRecord(paramName, `${paramVersion}`)
        ).to.be.rejectedWith(ParameterVersionNotFoundError);
      });
    });

    describe("getParamValue", () => {
      it("should return the parameter", async () => {
        const paramValue = `${count}`;
        ssmClient
          .on(GetParameterCommand, { Name: paramName, WithDecryption: true })
          .resolves({
            Parameter: { Value: paramValue },
          });

        const result = await store.getParamValue(paramName);

        expect(result).to.equal(paramValue);
        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(GetParameterCommand, {
            Name: paramName,
            WithDecryption: true,
          })
        ).to.exist.and.have.length(1);
      });

      it("should throw a ParameterNotFoundError if the parameter does not exist", async () => {
        ssmClient
          .on(GetParameterCommand)
          .rejects(new ParameterNotFound({ $metadata: {}, message: "" }));

        await expect(store.getParamValue(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should throw a ParameterVersionNotFoundError if the parameter version does not exist", async () => {
        ssmClient
          .on(GetParameterCommand)
          .rejects(
            new ParameterVersionNotFound({ $metadata: {}, message: "" })
          );

        await expect(store.getParamValue(paramName)).to.be.rejectedWith(
          ParameterVersionNotFoundError
        );
      });

      it("should throw a ParameterNotFoundError if the version is not set", async () => {
        ssmClient
          .on(GetParameterCommand, { Name: paramName })
          .resolves({ Parameter: {} });

        await expect(store.getParamValue(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should throw a ParameterNotFoundError if the parameter is not set", async () => {
        ssmClient.on(GetParameterCommand).resolves({});

        await expect(store.getParamValue(paramName)).to.be.rejectedWith(
          ParameterNotFoundError
        );
      });

      it("should rethrow an unknown error", async () => {
        const errorMsg = "Something bad happened.";
        ssmClient.on(GetParameterCommand).rejects(errorMsg);

        await expect(store.getParamValue(paramName)).to.be.rejectedWith(
          errorMsg
        );
      });
    });

    describe("writeParam", () => {
      it("should update the value and return the updated version", async () => {
        const paramValue = `${count}`;
        const nextVersion = count + 1;
        ssmClient
          .on(PutParameterCommand, { Name: paramName, Value: paramValue })
          .resolves({
            Version: nextVersion,
          });

        const result = await store.writeParam({
          name: paramName,
          value: paramValue,
        });

        expect(result).to.deep.equal({ updatedVersion: `${nextVersion}` });

        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(PutParameterCommand, {
            Name: paramName,
            Value: paramValue,
          })
        ).to.exist.and.have.length(1);
      });

      it("should update the value and set the description", async () => {
        const paramValue = `${count}`;
        const paramDescription = "This is a parameter in SSM.";
        const nextVersion = count + 1;
        ssmClient
          .on(PutParameterCommand, {
            Name: paramName,
            Value: paramValue,
            Description: paramDescription,
          })
          .resolves({
            Version: nextVersion,
          });

        const result = await store.writeParam({
          name: paramName,
          value: paramValue,
          description: paramDescription,
        });

        expect(result).to.deep.equal({ updatedVersion: `${nextVersion}` });

        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(PutParameterCommand, {
            Name: paramName,
            Value: paramValue,
            Description: paramDescription,
          })
        ).to.exist.and.have.length(1);
      });

      it("should update the value and set the parameter type", async () => {
        const paramValue = `${count}`;
        const paramType: ParameterType = "SecureString";
        const nextVersion = count + 1;
        ssmClient
          .on(PutParameterCommand, {
            Name: paramName,
            Value: paramValue,
            Type: paramType,
          })
          .resolves({
            Version: nextVersion,
          });

        const result = await store.writeParam({
          name: paramName,
          value: paramValue,
          type: paramType,
        });

        expect(result).to.deep.equal({ updatedVersion: `${nextVersion}` });
        sinon.assert.calledOnce(ssmClient.send);
        expect(
          ssmClient.commandCalls(PutParameterCommand, {
            Name: paramName,
            Value: paramValue,
            Type: paramType,
          })
        ).to.exist.and.have.length(1);
      });
    });
  });
});
