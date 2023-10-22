import { stat, unlink } from 'fs/promises';

type FileSystemError = Error & {
  errno: number;
  code: string;
  syscall: string;
  path: string;
};

const filepath = './test-script-output.txt';

const doesTestScriptOutputFileExist = async (): Promise<boolean> => {
  try {
    await stat(filepath);

    return true;
  } catch (err) {
    if (err instanceof Error && (err as FileSystemError).code === 'ENOENT') {
      return false;
    }

    throw err;
  }
};

export default async () => {
  if (!await doesTestScriptOutputFileExist()) {
    return;
  }

  await unlink(filepath);
};
