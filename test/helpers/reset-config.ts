import { readdir, unlink } from 'fs/promises';

export default async () => {
  const files = await readdir('.');

  await Promise.all(files
    .filter((file) => /\.griffin-config\..+\.yaml/.test(file))
    .map((file) => unlink(`./${file}`))
  );
};
