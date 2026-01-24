import { expect } from "chai";
import sinon, { SinonSandbox, SinonStubbedInstance, SinonStub } from "sinon";
import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";
import { ux } from "@oclif/core";
import { ParameterType } from "@aws-sdk/client-ssm";

import SSMWrite from "../../../src/commands/ssm/write.js";
import { SSMStore } from "../../../src/store/index.js";
import { ConfigFile, Source } from "../../../src/config/index.js";

describe("ssm:write", () => {
  let sandbox: SinonSandbox;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let paramName: string;
  let paramValue: string;
  let envVarName: string;
  const updatedVersion = "7";

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
    configFile = new (ConfigFile as unknown as {
      new (): ConfigFile;
    })() as SinonStubbedInstance<ConfigFile>;
    paramName = randomUUID();
    paramValue = randomUUID();
    envVarName = randomUUID().replaceAll("-", "_");
    SSMWrite.ssmStore = ssmStore;
    SSMWrite.configFile = configFile;
  });

  afterEach(() => {
    SSMWrite.ssmStore = undefined;
    SSMWrite.configFile = undefined;
    sandbox.restore();
  });

  describe("happy path", () => {
    beforeEach(() => {
      sandbox.stub(ssmStore, "writeParam").resolves({ updatedVersion });
      sandbox.stub(configFile, "hasParamConfig").returns(false);
      sandbox.stub(configFile, "setParamConfig").returns();
      sandbox.stub(configFile, "save").resolves();
    });

    it("should use the value specified with the --value flag", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--type",
        "SecureString",
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("value", paramValue)
      );
    });

    it("should prompt the user for the value", async () => {
      sandbox.stub(ux, "prompt").resolves(paramValue);

      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--type",
        "SecureString",
      ]);

      sinon.assert.calledOnce(ux.prompt as SinonStub);
      sinon.assert.calledWith(
        ux.prompt as SinonStub,
        "Value",
        sinon.match.has("type", "mask")
      );
      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("value", paramValue)
      );
    });

    it("should save the description if provided", async () => {
      const description = `${randomUUID()} ${randomUUID()}`;

      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--type",
        "SecureString",
        "--description",
        `"${description}"`,
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("description", description)
      );
    });

    it("should use the parameter type specified with --type", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--type",
        "String",
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("type", "String")
      );
    });

    it("should default the type to SecureString if --type is not specified", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("type", ParameterType.SECURE_STRING)
      );
    });

    it("should require the --name flag", async () => {
      const { error, stderr } = await runCommand([
        "ssm:write",
        "--value",
        paramValue,
        "--type",
        ParameterType.SECURE_STRING,
      ]);

      expect(error?.oclif?.exit).to.equal(1);
      expect(stderr).to.contain("name").and.contain("required");
    });

    it("should use the env var name specified with the --env-var-name flag", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--env-var-name",
        envVarName,
      ]);

      sinon.assert.calledOnce(configFile.setParamConfig);
      sinon.assert.calledWith(
        configFile.setParamConfig,
        Source.SSM,
        paramName,
        sinon.match.has("envVarName", envVarName)
      );
    });

    it("should default to the name of the parameter (without the prefix) for new parameters", async () => {
      const name = "/test/this-is-a-name";
      const expectedEnvVarName = "THIS_IS_A_NAME";

      await runCommand(["ssm:write", "--name", name, "--value", paramValue]);

      sinon.assert.calledOnce(configFile.setParamConfig);
      sinon.assert.calledWith(
        configFile.setParamConfig,
        Source.SSM,
        name,
        sinon.match.has("envVarName", expectedEnvVarName)
      );
    });

    it("should save the current version to the config file", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
      ]);

      sinon.assert.calledOnce(configFile.setParamConfig);
      sinon.assert.calledWith(
        configFile.setParamConfig,
        Source.SSM,
        paramName,
        sinon.match.has("version", updatedVersion)
      );
    });

    it("should not lock the version in the config file if --always-use-latest is specified", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--always-use-latest",
      ]);

      sinon.assert.calledOnce(configFile.setParamConfig);
      sinon.assert.calledWith(
        configFile.setParamConfig,
        Source.SSM,
        paramName,
        sinon.match.has("version", undefined)
      );
    });

    it("should set allowMissingValue to true in the config if --optional is specified", async () => {
      await runCommand([
        "ssm:write",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--optional",
      ]);

      sinon.assert.calledOnce(configFile.setParamConfig);
      sinon.assert.calledWith(
        configFile.setParamConfig,
        Source.SSM,
        paramName,
        sinon.match.has("allowMissingValue", true)
      );
    });

    describe("skip unchanged", () => {
      it("should not update the parameter if the value has not changed", async () => {
        sandbox.stub(ssmStore, "getParamValue").resolves(paramValue);

        await runCommand([
          "ssm:write",
          "--name",
          paramName,
          "--value",
          paramValue,
          "--type",
          "SecureString",
          "--skip-unchanged",
        ]);

        sinon.assert.notCalled(ssmStore.writeParam);
      });

      it("should update the parameter if the value has changed", async () => {
        sandbox.stub(ssmStore, "getParamValue").resolves(`${paramValue}_old`);

        await runCommand([
          "ssm:write",
          "--name",
          paramName,
          "--value",
          paramValue,
          "--type",
          "SecureString",
          "--skip-unchanged",
        ]);

        sinon.assert.calledOnce(ssmStore.writeParam);
      });
    });
  });
});
