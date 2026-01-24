import sinon, { SinonSandbox, SinonStubbedInstance } from "sinon";
import { stdin as mockStdin, MockSTDIN } from "mock-stdin";
import { ConfigFile } from "../../src/config/index.js";

export interface TestContext {
  sandbox: SinonSandbox;
  configFile: SinonStubbedInstance<ConfigFile>;
  stdin: MockSTDIN;
  _env: Record<string, string | undefined>;
}

export function createTestContext(): TestContext {
  return {
    sandbox: sinon.createSandbox(),
    configFile: new (ConfigFile as unknown as {
      new (): ConfigFile;
    })() as SinonStubbedInstance<ConfigFile>,
    stdin: mockStdin(),
    _env: {},
  };
}

export function cleanupTestContext(ctx: TestContext): void {
  ctx.sandbox.restore();
  ctx.stdin.restore();
  restoreEnv(ctx);
}

export function setEnv(ctx: TestContext, name: string, value: string): void {
  ctx._env[name] = process.env[name];
  process.env[name] = value;
}

export function restoreEnv(ctx: TestContext): void {
  for (const [name, value] of Object.entries(ctx._env)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  ctx._env = {};
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
