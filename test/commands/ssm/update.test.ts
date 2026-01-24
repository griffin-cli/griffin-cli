import { expect } from "chai";
import sinon, { SinonSandbox, SinonStubbedInstance, SinonStub } from "sinon";
import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";
import { ux } from "@oclif/core";

import SSMUpdate from "../../../src/commands/ssm/update.js";
import { SSMStore } from "../../../src/store/index.js";
import { ConfigFile, Source } from "../../../src/config/index.js";

describe("ssm:update", () => {
  let sandbox: SinonSandbox;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let paramName: string;
  let paramValue: string;
  let envVarName: string;
  const originalVersion = "6";
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
    SSMUpdate.ssmStore = ssmStore;
    SSMUpdate.configFile = configFile;
  });

  afterEach(() => {
    SSMUpdate.ssmStore = undefined;
    SSMUpdate.configFile = undefined;
    sandbox.restore();
  });

  it("should throw an error if the param config does not exist", async () => {
    sandbox.stub(configFile, "hasParamConfig").returns(false);

    const { error, stderr } = await runCommand([
      "ssm:update",
      "--name",
      paramName,
      "--value",
      paramValue,
    ]);

    expect(error?.oclif?.exit).to.equal(1);
    expect(stderr).to.contain("Parameter config not found");
  });

  describe("happy path", () => {
    beforeEach(() => {
      sandbox.stub(configFile, "hasParamConfig").returns(true);
      sandbox.stub(ssmStore, "writeParam").resolves({ updatedVersion });
      sandbox.stub(configFile, "setParamConfig").returns();
      sandbox.stub(configFile, "save").resolves();
    });

    it("should use the value specified with the --value flag", async () => {
      await runCommand([
        "ssm:update",
        "--name",
        paramName,
        "--value",
        paramValue,
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("value", paramValue)
      );
    });

    it("should prompt the user for the value", async () => {
      sandbox.stub(ux, "prompt").resolves(paramValue);

      await runCommand(["ssm:update", "--name", paramName]);

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
        "ssm:update",
        "--name",
        paramName,
        "--value",
        paramValue,
        "--description",
        `"${description}"`,
      ]);

      sinon.assert.calledOnce(ssmStore.writeParam);
      sinon.assert.calledWith(
        ssmStore.writeParam,
        sinon.match.has("description", description)
      );
    });

    it("should require the --name flag", async () => {
      const { error, stderr } = await runCommand([
        "ssm:update",
        "--value",
        paramValue,
      ]);

      expect(error?.oclif?.exit).to.equal(1);
      expect(stderr).to.contain("name").and.contain("required");
    });

    it("should save the current version to the config file when version was previously locked", async () => {
      sandbox.stub(configFile, "getParamConfig").returns({
        envVarName,
        version: originalVersion,
      });

      await runCommand([
        "ssm:update",
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

    it("should not lock the version in the config file if the version was not previously locked", async () => {
      sandbox.stub(configFile, "getParamConfig").returns({
        envVarName,
      });

      await runCommand([
        "ssm:update",
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
        sinon.match.has("version", undefined)
      );
    });

    describe("skip unchanged", () => {
      it("should not update the parameter if the value has not changed", async () => {
        sandbox.stub(ssmStore, "getParamValue").resolves(paramValue);

        await runCommand([
          "ssm:update",
          "--name",
          paramName,
          "--value",
          paramValue,
          "--skip-unchanged",
        ]);

        sinon.assert.notCalled(ssmStore.writeParam);
      });

      it("should update the parameter if the value has changed", async () => {
        sandbox.stub(ssmStore, "getParamValue").resolves(`${paramValue}_old`);

        await runCommand([
          "ssm:update",
          "--name",
          paramName,
          "--value",
          paramValue,
          "--skip-unchanged",
        ]);

        sinon.assert.calledOnce(ssmStore.writeParam);
      });
    });
  });
});
