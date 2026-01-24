import sinon, { SinonSandbox, SinonStubbedInstance } from "sinon";
import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";

import SSMDelete from "../../../src/commands/ssm/delete.js";
import { SSMStore } from "../../../src/store/index.js";
import { ConfigFile, Source } from "../../../src/config/index.js";

describe("ssm:delete", () => {
  let sandbox: SinonSandbox;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let configFile: SinonStubbedInstance<ConfigFile>;
  let paramName: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
    configFile = new (ConfigFile as unknown as {
      new (): ConfigFile;
    })() as SinonStubbedInstance<ConfigFile>;
    paramName = randomUUID();
    SSMDelete.ssmStore = ssmStore;
    SSMDelete.configFile = configFile;
    sandbox.stub(ssmStore, "delete").resolves();
  });

  afterEach(() => {
    SSMDelete.ssmStore = undefined;
    SSMDelete.configFile = undefined;
    sandbox.restore();
  });

  it("should delete the parameter and remove it from the config file", async () => {
    sandbox.stub(configFile, "hasParamConfig").returns(true);
    sandbox.stub(configFile, "removeParamConfig").returns();
    sandbox.stub(configFile, "save").resolves();

    await runCommand(["ssm:delete", "--name", paramName]);

    sinon.assert.calledOnce(ssmStore.delete);
    sinon.assert.calledWith(ssmStore.delete, paramName);
    sinon.assert.calledOnce(configFile.removeParamConfig);
    sinon.assert.calledWith(
      configFile.removeParamConfig,
      Source.SSM,
      paramName
    );
  });

  it("should delete the parameter even if the parameter is not tracked", async () => {
    sandbox.stub(configFile, "hasParamConfig").returns(false);

    await runCommand(["ssm:delete", "--name", paramName]);

    sinon.assert.calledOnce(ssmStore.delete);
    sinon.assert.calledWith(ssmStore.delete, paramName);
  });
});
