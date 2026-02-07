import yaml from "yaml";

import { runCommand } from "@oclif/test";
import { randomUUID } from "crypto";
import { expect } from "chai";
import clearSSM from "../helpers/clear-ssm.js";
import clearTestScriptOutput from "../helpers/clear-test-script-output.js";
import { mkdir, readFile, rm, stat, unlink, writeFile } from "fs/promises";
import addParam from "../helpers/add-param.js";
import {
  DeleteParameterCommand,
  ParameterType,
  PutParameterCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { ConfigFile, Source } from "../../src/config/index.js";
import EnvFile from "../../src/utils/envfile.js";
import { resolve } from "path";
import runCommandWithStdin from "../helpers/run-command-with-stdin.js";

type FileSystemError = Error & {
  errno: number;
  code: string;
  syscall: string;
  path: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const doesFileExist = async (filepath: string): Promise<boolean> => {
  try {
    await stat(filepath);

    return true;
  } catch (err) {
    if (err instanceof Error && (err as FileSystemError).code === "ENOENT") {
      return false;
    }

    throw err;
  }
};

const waitForFileMissing = async (
  filepath: string,
  timeoutMs = 2000,
  intervalMs = 50
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (!await doesFileExist(filepath)) {
      return;
    }
    await sleep(intervalMs);
  }
};

describe("SSM", () => {
  const envName = "test";
  const originalEnv = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  };
  let testDir: string;
  let originalCwd: string;

  before(() => {
    process.env.AWS_REGION = "us-east-1";
    process.env.AWS_ACCESS_KEY_ID = "abc";
    process.env.AWS_SECRET_ACCESS_KEY = "123";
  });

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = resolve(originalCwd, `.tmp_test/${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    await clearSSM();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(".tmp_test", { recursive: true, force: true });
    await clearTestScriptOutput();
    await clearSSM();
  });

  after(() => {
    process.env.AWS_REGION = originalEnv.AWS_REGION;
    process.env.AWS_ACCESS_KEY_ID = originalEnv.AWS_ACCESS_KEY_ID;
    process.env.AWS_SECRET_ACCESS_KEY = originalEnv.AWS_SECRET_ACCESS_KEY;
  });

  it("should migrate legacy config files", async () => {
    const prodConfig = {
      [Source.SSM]: {
        [randomUUID()]: {
          version: 5,
          envVarName: "TEST_1",
        },
        [randomUUID()]: {
          envVarName: "TEST_2",
        },
      },
    };
    const devConfig = {
      [Source.SSM]: {
        [randomUUID()]: {
          version: 5,
          envVarName: "TEST_1",
        },
        [randomUUID()]: {
          envVarName: "TEST_2",
        },
      },
    };

    const prodJsonPath = resolve(testDir, ".griffin-config.prod.json");
    const devJsonPath = resolve(testDir, ".griffin-config.dev.json");
    const prodYamlPath = resolve(testDir, ".griffin-config.prod.yaml");
    const devYamlPath = resolve(testDir, ".griffin-config.dev.yaml");

    await writeFile(prodJsonPath, JSON.stringify(prodConfig));
    await writeFile(devJsonPath, JSON.stringify(devConfig));

    await runCommandWithStdin(
      [
        "ssm:create",
        "--cwd",
        testDir,
        "--env",
        envName,
        "-n",
        `/test/${randomUUID()}`,
        "-v",
        "test",
      ],
      "y\n",
      500
    );

    await waitForFileMissing(prodJsonPath);
    await waitForFileMissing(devJsonPath);

    await expect(doesFileExist(prodJsonPath)).to.eventually.be.false;
    await expect(doesFileExist(devJsonPath)).to.eventually.be.false;

    await expect(doesFileExist(prodYamlPath)).to.eventually.be
      .true;
    await expect(doesFileExist(devYamlPath)).to.eventually.be
      .true;

    const prodData = await readFile(prodYamlPath, {
      encoding: "utf8",
    });
    expect(yaml.parse(prodData)).to.deep.equal(prodConfig);

    const devData = await readFile(devYamlPath, {
      encoding: "utf8",
    });
    expect(yaml.parse(devData)).to.deep.equal(devConfig);
  });

  it("should print an error message if the env is invalid", async () => {
    const { error, stderr } = await runCommand([
      "export",
      "--env",
      "inv@lid",
      "--format",
      "dotenv",
    ]);

    expect(error?.oclif?.exit).to.equal(1);
    expect(stderr).to.contain(
      'Environment must only contain alphanumeric characters and "_" or "-".'
    );
  });

  it("should print the updated value", async () => {
    const paramName = "/test/var";
    const paramValue = randomUUID();

    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      paramName,
      "--value",
      paramValue,
    ]);

    await runCommand([
      "ssm:read",
      "--env",
      envName,
      "--name",
      paramName,
      "--quiet",
    ]);

    const updatedParamValue = randomUUID();

    await runCommand([
      "ssm:update",
      "--env",
      envName,
      "--name",
      paramName,
      "--value",
      updatedParamValue,
    ]);

    const { stdout } = await runCommand([
      "ssm:read",
      "--env",
      envName,
      "--name",
      paramName,
      "--quiet",
    ]);

    expect(stdout).to.match(new RegExp(`^${updatedParamValue}$`, "m"));
  });

  it("should export to dotenv format", async () => {
    const param1 = {
      name: "/param/one",
      envVarName: "ONE",
      value: randomUUID(),
    };
    const param2 = {
      name: "/param/two",
      envVarName: "TWO",
      value: randomUUID(),
    };
    const param3 = {
      name: "/param/three",
      envVarName: "THREE",
      value: randomUUID(),
    };

    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param1.name,
      "--env-var-name",
      param1.envVarName,
      "--value",
      param1.value,
    ]);
    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param2.name,
      "--env-var-name",
      param2.envVarName,
      "--value",
      param2.value,
    ]);
    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param3.name,
      "--env-var-name",
      param3.envVarName,
      "--value",
      param3.value,
    ]);

    const { stdout } = await runCommand([
      "export",
      "--env",
      envName,
      "--format",
      "dotenv",
    ]);

    expect(stdout).to.match(
      new RegExp(`^${param1.envVarName}=${param1.value}$`, "m")
    );
    expect(stdout).to.match(
      new RegExp(`^${param2.envVarName}=${param2.value}$`, "m")
    );
    expect(stdout).to.match(
      new RegExp(`^${param3.envVarName}=${param3.value}$`, "m")
    );
  });

  it("should execute the command", async () => {
    const param1 = {
      name: "/param/one",
      envVarName: "ONE",
      value: randomUUID(),
    };
    const param2 = {
      name: "/param/two",
      envVarName: "TWO",
      value: randomUUID(),
    };
    const param3 = {
      name: "/param/three",
      envVarName: "THREE",
      value: randomUUID(),
    };

    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param1.name,
      "--env-var-name",
      param1.envVarName,
      "--value",
      param1.value,
    ]);
    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param2.name,
      "--env-var-name",
      param2.envVarName,
      "--value",
      param2.value,
    ]);
    await runCommand([
      "ssm:create",
      "--env",
      envName,
      "--name",
      param3.name,
      "--env-var-name",
      param3.envVarName,
      "--value",
      param3.value,
    ]);

    await runCommand([
      "exec",
      "--env",
      envName,
      "--skip-exit",
      "--",
      "../../test/integration/test-script.sh",
      `--name=${param1.envVarName}`,
      param2.envVarName,
      `--name=${param3.envVarName}`,
    ]);

    await sleep(5_000);

    const output = (await readFile("./test-script-output.txt")).toString();

    expect(output).to.match(new RegExp(`^${param1.value}$`, "m"));
    expect(output).to.match(new RegExp(`^${param2.value}$`, "m"));
    expect(output).to.match(new RegExp(`^${param3.value}$`, "m"));
  });

  it("should save the config to the config file in the cwd directory", async () => {
    const cwd = "./cwd_test";
    try {
      const param1 = {
        name: "/param/one",
        envVarName: "ONE",
        value: randomUUID(),
      };

      await runCommand([
        "ssm:create",
        "--cwd",
        cwd,
        "--env",
        envName,
        "--name",
        param1.name,
        "--env-var-name",
        param1.envVarName,
        "--value",
        param1.value,
      ]);

      await runCommand([
        "exec",
        "--cwd",
        cwd,
        "--env",
        envName,
        "--skip-exit",
        "--",
        "../../test/integration/test-script.sh",
        `--name=${param1.envVarName}`,
      ]);

      await sleep(5_000);

      const dirStats = await stat(resolve(process.cwd(), cwd));
      expect(dirStats.isDirectory()).to.equal(true);

      const fileStats = await stat(
        resolve(process.cwd(), cwd, `.griffin-config.${envName}.yaml`)
      );
      expect(fileStats.isFile()).to.equal(true);

      const output = (await readFile("./test-script-output.txt")).toString();
      expect(output).to.match(new RegExp(`^${param1.value}$`, "m"));
    } finally {
      await rm(resolve(process.cwd(), cwd), { recursive: true });
    }
  });

  it("should not throw an error if the directory already exists", async () => {
    const cwd = "./cwd_test";
    try {
      const param1 = {
        name: "/param/one",
        envVarName: "ONE",
        value: randomUUID(),
      };
      const param2 = {
        name: "/param/two",
        envVarName: "TWO",
        value: randomUUID(),
      };

      await runCommand([
        "ssm:create",
        "--cwd",
        cwd,
        "--env",
        envName,
        "--name",
        param1.name,
        "--env-var-name",
        param1.envVarName,
        "--value",
        param1.value,
      ]);
      await runCommand([
        "ssm:create",
        "--cwd",
        cwd,
        "--env",
        envName,
        "--name",
        param2.name,
        "--env-var-name",
        param2.envVarName,
        "--value",
        param2.value,
      ]);

      await runCommand([
        "exec",
        "--cwd",
        cwd,
        "--env",
        envName,
        "--skip-exit",
        "--",
        "../../test/integration/test-script.sh",
        `--name=${param1.envVarName}`,
        param2.envVarName,
      ]);

      await sleep(5_000);

      const dirStats = await stat(resolve(process.cwd(), cwd));
      expect(dirStats.isDirectory()).to.equal(true);

      const fileStats = await stat(
        resolve(process.cwd(), cwd, `.griffin-config.${envName}.yaml`)
      );
      expect(fileStats.isFile()).to.equal(true);

      const output = (await readFile("./test-script-output.txt")).toString();
      expect(output).to.match(new RegExp(`^${param1.value}$`, "m"));
      expect(output).to.match(new RegExp(`^${param2.value}$`, "m"));
    } finally {
      await rm(resolve(process.cwd(), cwd), { recursive: true });
    }
  });

  describe("import", () => {
    describe("dotenv", () => {
      let filename: string;
      let prefix: string;
      let params: Record<string, string>;

      beforeEach(async () => {
        filename = `test-${randomUUID()}.env`;
        prefix = `/griffin-test/${randomUUID()}`;
        params = {
          URL: "https://www.google.com/?q=recursion",
          MULTILINE_ESCAPED: "line1\\nline2\\nline3",
          BOOL: "true",
          NUMBER: "42",
        };

        await writeFile(filename, EnvFile.stringify(params));
      });

      afterEach(async () => {
        try {
          await unlink(filename);
        } catch (err) {
          // Ignore an error here...
        }
      });

      it("should import dotenv files", async () => {
        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          prefix,
        ]);

        await runCommand([
          "exec",
          "--env",
          envName,
          "--skip-exit",
          "--",
          "../../test/integration/test-script.sh",
          "URL",
          "MULTILINE_ESCAPED",
          "BOOL",
          "NUMBER",
        ]);

        await sleep(5_000);

        const output = (await readFile("./test-script-output.txt")).toString();

        expect(output.trim()).to.equal(`${params.URL}
${params.MULTILINE_ESCAPED}
${params.BOOL}
${params.NUMBER}`);
      });

      it("should lock the versions", async () => {
        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          prefix,
        ]);

        const configFile = await ConfigFile.loadConfig(envName);

        Object.keys(params).forEach((paramName) => {
          expect(
            configFile.getParamConfig(Source.SSM, `${prefix}/${paramName}`)
              ?.version
          ).to.equal("1");
        });
      });

      it("should work if the prefix does not start with a slash", async () => {
        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          prefix.replace(/^\//, ""),
        ]);

        const configFile = await ConfigFile.loadConfig(envName);

        Object.keys(params).forEach((paramName) => {
          expect(
            configFile.getParamConfig(Source.SSM, `${prefix}/${paramName}`)
          ).to.exist;
        });
      });

      it("should work if the prefix ends with a slash", async () => {
        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          `${prefix}/`,
        ]);

        const configFile = await ConfigFile.loadConfig(envName);

        Object.keys(params).forEach((paramName) => {
          expect(
            configFile.getParamConfig(Source.SSM, `${prefix}/${paramName}`)
          ).to.exist;
        });
      });

      it("should not fail if a parameter already exists", async () => {
        await addParam({
          name: `${prefix}/URL`,
          value: "https://bing.com/",
        });

        const { stderr } = await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          prefix,
        ]);

        expect(stderr).to.include("Failed to import");
      });

      it("should overwrite parameters if the overwrite flag is provided", async () => {
        const overwrittenParam = `${prefix}/URL`;

        await addParam({
          name: overwrittenParam,
          value: "https://bing.com/",
        });

        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "--from-dotenv",
          filename,
          "--prefix",
          prefix,
          "--overwrite",
        ]);

        await runCommand([
          "exec",
          "--env",
          envName,
          "--skip-exit",
          "--",
          "../../test/integration/test-script.sh",
          "URL",
        ]);

        const configFile = await ConfigFile.loadConfig(envName);

        expect(
          configFile.getParamConfig(Source.SSM, overwrittenParam)?.version
        ).to.equal("2");

        await sleep(5_000);

        const output = (await readFile("./test-script-output.txt")).toString();
        expect(output.trim()).to.equal(params.URL);
      });
    });

    describe("ssm", () => {
      let paramName: string;
      let ssmClient: SSMClient;

      beforeEach(async () => {
        paramName = `/griffin-cli/test/${randomUUID()}`;
        ssmClient = new SSMClient({
          endpoint: process.env.GRIFFIN_AWS_SSM_ENDPOINT,
        });

        await ssmClient.send(
          new PutParameterCommand({
            Name: paramName,
            Value: randomUUID(),
            Type: "SecureString",
            Overwrite: true,
          })
        );
      });

      afterEach(async () => {
        await ssmClient.send(
          new DeleteParameterCommand({
            Name: paramName,
          })
        );
      });

      it("should log an error if the parameter does not exist", async () => {
        const { error, stderr } = await runCommand([
          "ssm:import",
          "--env",
          envName,
          "-n",
          `/griffin-cli/test/${randomUUID()}`,
        ]);

        expect(error?.oclif?.exit).to.equal(1);
        expect(stderr.toLowerCase()).to.contain("parameter not found");
      });

      it("should log an error if the parameter has already been imported", async () => {
        await runCommand(["ssm:import", "--env", envName, "-n", paramName]);

        const { error, stderr } = await runCommand([
          "ssm:import",
          "--env",
          envName,
          "-n",
          paramName,
        ]);

        expect(error?.oclif?.exit).to.equal(1);
        expect(stderr.toLowerCase()).to.contain("parameter already exists");
      });

      it("should import the parameter without locking the version", async () => {
        await runCommand([
          "ssm:import",
          "--env",
          envName,
          "-n",
          paramName,
          "--always-use-latest",
        ]);

        const configFile = await ConfigFile.loadConfig(envName);

        expect(
          configFile.getParamConfig(Source.SSM, paramName)
        ).to.exist.and.not.have.property("version");
      });

      it("should import the parameter", async () => {
        await runCommand(["ssm:import", "--env", envName, "-n", paramName]);

        const configFile = await ConfigFile.loadConfig(envName);

        expect(configFile.getParamConfig(Source.SSM, paramName))
          .to.exist.and.have.property("version")
          .that.equals("1");
      });
    });

    describe("chamber", () => {
      let serviceName: string;
      let serviceEnvName: string;
      let params: Array<{ name: string; value: string }>;

      beforeEach(async () => {
        serviceName = "griffin-cli";
        serviceEnvName = "griffin-cli-test";
        params = [
          { name: `/${serviceName}/param-one`, value: randomUUID() },
          { name: `/${serviceName}/param-two`, value: randomUUID() },
          { name: `/${serviceEnvName}/param-three`, value: randomUUID() },
          { name: `/${serviceEnvName}/param-one`, value: randomUUID() },
        ];

        await Promise.all(
          params.map((param) =>
            addParam({
              name: param.name,
              value: param.value,
              type: ParameterType.SECURE_STRING,
            })
          )
        );
      });

      it("should import chamber params and lock the version", async () => {
        await runCommand([
          "ssm:import",
          "-c",
          serviceName,
          "-c",
          serviceEnvName,
        ]);

        await addParam({
          name: params[2].name,
          value: randomUUID(),
        });

        await runCommand([
          "exec",
          "--skip-exit",
          "--",
          "../../test/integration/test-script.sh",
          "--name=PARAM_ONE",
          "PARAM_TWO",
          "--name=PARAM_THREE",
        ]);

        await sleep(5_000);

        const output = (await readFile("./test-script-output.txt")).toString();

        expect(output).to.match(new RegExp(`^${params[1].value}$`, "m"));
        expect(output).to.match(new RegExp(`^${params[2].value}$`, "m"));
        expect(output).to.match(new RegExp(`^${params[3].value}$`, "m"));
      });

      it("should import chamber params without locking the version", async () => {
        const updatedParamValue = randomUUID();

        await runCommand([
          "ssm:import",
          "-c",
          serviceName,
          "-c",
          serviceEnvName,
          "--always-use-latest",
          "--optional",
        ]);

        await addParam({
          name: params[2].name,
          value: updatedParamValue,
        });

        await runCommand([
          "exec",
          "--skip-exit",
          "--",
          "../../test/integration/test-script.sh",
          "--name=PARAM_ONE",
          "PARAM_TWO",
          "--name=PARAM_THREE",
        ]);

        await sleep(5_000);

        const output = (await readFile("./test-script-output.txt")).toString();

        expect(output).to.match(new RegExp(`^${params[1].value}$`, "m"));
        expect(output).to.match(new RegExp(`^${params[3].value}$`, "m"));

        expect(output).to.match(new RegExp(`^${updatedParamValue}$`, "m"));
      });
    });
  });
});
