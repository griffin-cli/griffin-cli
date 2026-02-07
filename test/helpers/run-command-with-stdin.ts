import { runCommand } from "@oclif/test";
import { stdin as mockStdin } from "mock-stdin";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForListeners = async (
  stdin: ReturnType<typeof mockStdin>,
  timeoutMs = 2000,
  intervalMs = 10
) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (stdin.listenerCount("data") > 0 || stdin.listenerCount("end") > 0) {
      return;
    }
    await sleep(intervalMs);
  }
};

const runCommandWithStdin = async (
  argv: string[],
  input: string | string[],
  delay = 0
) => {
  const stdin = mockStdin();
  try {
    const command = runCommand(argv);
    if (delay > 0) {
      await sleep(delay);
    }
    await waitForListeners(stdin);
    stdin.send(input).end();
    return await command;
  } finally {
    stdin.restore();
  }
};

export default runCommandWithStdin;
