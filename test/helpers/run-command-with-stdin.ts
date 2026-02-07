import { runCommand } from "@oclif/test";
import { stdin as mockStdin } from "mock-stdin";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runCommandWithStdin = async (
  argv: string[],
  input: string | string[],
  delay = 10
) => {
  const stdin = mockStdin();
  try {
    const command = runCommand(argv);
    await sleep(delay);
    stdin.send(input).end();
    return await command;
  } finally {
    stdin.restore();
  }
};

export default runCommandWithStdin;
