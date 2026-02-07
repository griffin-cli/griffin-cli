import sinon, { SinonSandbox, SinonStubbedInstance, SinonStub } from "sinon";
import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";

import SSMHistory from "../../../src/commands/ssm/history.js";
import { SSMStore } from "../../../src/store/index.js";
import { DataLogger } from "../../../src/utils/index.js";

describe("ssm:history", () => {
  let sandbox: SinonSandbox;
  let ssmStore: SinonStubbedInstance<SSMStore>;
  let paramName: string;
  let historyRecords: Array<{
    name: string;
    value: string;
    version: string;
    modifiedAt: Date;
    modifiedBy: string;
  }>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
    paramName = `/griffin/test/${randomUUID()}`;
    historyRecords = [
      {
        name: paramName,
        value: randomUUID(),
        version: "1",
        modifiedAt: new Date(),
        modifiedBy: "griffin",
      },
    ];
    SSMHistory.ssmStore = ssmStore;
    sandbox
      .stub(ssmStore, "getHistory")
      .withArgs(paramName)
      .resolves(historyRecords);
    sandbox.stub(DataLogger, "log").returns();
  });

  afterEach(() => {
    SSMHistory.ssmStore = undefined;
    sandbox.restore();
  });

  it("should log the history records", async () => {
    await runCommand(["ssm:history", "--name", paramName, "--extended"]);

    sinon.assert.calledOnce(ssmStore.getHistory);
    sinon.assert.calledOnce(DataLogger.log as SinonStub);
    sinon.assert.calledWith(
      DataLogger.log as SinonStub,
      sinon.match({
        name: {},
        description: {
          extended: true,
        },
        value: {},
        version: {},
        modifiedAt: {},
        modifiedBy: {},
      }),
      historyRecords,
      sinon.match.has("extended", true)
    );
  });
});
