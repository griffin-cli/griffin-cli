import { expect } from "chai";
import sinon, { SinonSandbox, SinonStubbedInstance } from "sinon";
import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";

import SSMImport from "../../../src/commands/ssm/import.js";
import { SSMStore } from "../../../src/store/index.js";
import { ConfigFile, Source } from "../../../src/config/index.js";
import EnvFile from "../../../src/utils/envfile.js";
import { normalizeEnvVarName } from "../../../src/utils/index.js";

describe("ssm:import", () => {
  describe("--from-dotenv", () => {
    let sandbox: SinonSandbox;
    let ssmStore: SinonStubbedInstance<SSMStore>;
    let configFile: SinonStubbedInstance<ConfigFile>;
    let prefix: string;
    let dotenvFilename: string;
    let jsonConfig: Record<string, string | number | boolean>;
    let dotenvContents: string;

    beforeEach(async () => {
      sandbox = sinon.createSandbox();
      ssmStore = new SSMStore() as SinonStubbedInstance<SSMStore>;
      configFile = new (ConfigFile as unknown as {
        new (): ConfigFile;
      })() as SinonStubbedInstance<ConfigFile>;
      prefix = `/${randomUUID()}`;
      dotenvFilename = `${randomUUID()}.env`;
      jsonConfig = {
        URL: "https://www.google.com/q?emacs",
        number: 42,
        bool: true,
        multiLineString: "line1\nline2\nline3",
        escapedMultiLineString: "line1\\nline2\\nline3",
      };
      dotenvContents = EnvFile.stringify(jsonConfig);

      await writeFile(dotenvFilename, dotenvContents);

      SSMImport.ssmStore = ssmStore;
      SSMImport.configFile = configFile;
    });

    afterEach(async () => {
      SSMImport.ssmStore = undefined;
      SSMImport.configFile = undefined;
      sandbox.restore();
      try {
        await unlink(dotenvFilename);
      } catch {
        // File may not exist
      }
    });

    describe("happy path", () => {
      beforeEach(() => {
        sandbox.stub(ssmStore, "writeParam").resolves({ updatedVersion: "1" });
        sandbox.stub(configFile, "setParamConfig").returns();
        sandbox.stub(configFile, "save").resolves();
      });

      it("should upload all the parameters to SSM", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        sinon.assert.callCount(
          ssmStore.writeParam,
          Object.keys(jsonConfig).length
        );
      });

      it("should add all of the parameters to the config file", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        sinon.assert.callCount(
          configFile.setParamConfig,
          Object.keys(jsonConfig).length
        );
        Object.keys(jsonConfig).forEach((key) =>
          sinon.assert.calledWith(
            configFile.setParamConfig,
            Source.SSM,
            `${prefix}/${key.toUpperCase()}`
          )
        );
      });

      it("should upload the parameters properly if the prefix starts with a forward slash", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        Object.keys(jsonConfig).forEach((key) => {
          const expectedName = `${prefix}/${normalizeEnvVarName(key)}`;
          sinon.assert.calledWith(
            ssmStore.writeParam,
            sinon.match
              .has("name", expectedName)
              .and(sinon.match.has("value", `${jsonConfig[key]}`))
          );
        });
      });

      it("should not lock the version if --always-use-latest is specified", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
          "--always-use-latest",
        ]);

        sinon.assert.callCount(
          configFile.setParamConfig,
          Object.keys(jsonConfig).length
        );
        sinon.assert.alwaysCalledWith(
          configFile.setParamConfig,
          Source.SSM,
          sinon.match.string,
          sinon.match.has("version", undefined)
        );
      });

      it("should lock the version", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        sinon.assert.callCount(
          configFile.setParamConfig,
          Object.keys(jsonConfig).length
        );
        sinon.assert.alwaysCalledWith(
          configFile.setParamConfig,
          Source.SSM,
          sinon.match.string,
          sinon.match.has("version", "1")
        );
      });

      it("should allow missing values if --optional is specified", async () => {
        await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
          "--optional",
        ]);

        sinon.assert.callCount(
          configFile.setParamConfig,
          Object.keys(jsonConfig).length
        );
        sinon.assert.alwaysCalledWith(
          configFile.setParamConfig,
          Source.SSM,
          sinon.match.string,
          sinon.match.has("allowMissingValue", true)
        );
      });
    });

    describe("upload failure", () => {
      let uploadErr: Error;

      beforeEach(() => {
        uploadErr = new Error(
          "there was an error, probably something with param name"
        );
        sandbox
          .stub(ssmStore, "writeParam")
          .resolves({ updatedVersion: "1" })
          .onSecondCall()
          .rejects(uploadErr);
        sandbox.stub(configFile, "setParamConfig").returns();
        sandbox.stub(configFile, "save").resolves();
      });

      it("should log a failure to upload a parameter", async () => {
        const { stderr } = await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        expect(stderr.trim()).to.equal(
          `Failed to import NUMBER: ${uploadErr.message}`
        );
      });

      it("should not exit if a parameter fails to upload to SSM", async () => {
        const { stdout } = await runCommand([
          "ssm:import",
          "--from-dotenv",
          dotenvFilename,
          "--prefix",
          prefix,
        ]);

        expect(stdout.trim()).to.match(
          new RegExp(
            `Successfully imported ${
              Object.keys(jsonConfig).length - 1
            } parameters.$`
          )
        );
      });
    });
  });
});
