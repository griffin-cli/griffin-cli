import { ux } from '@oclif/core';

import InputOptions from '../store/input-options.js';

const readValueFromSTDIN = (readSingleLine?: boolean): Promise<string> => new Promise((resolve) => {
  const pipe = process.stdin;
  pipe.setEncoding('utf-8');

  if (pipe.isTTY) {
    resolve('');
    return;
  }

  let data = '';

  pipe.on('data', (chunk) => {
    data += chunk;

    if (readSingleLine && data.includes('\n')) {
      pipe.end();
    }
  });

  pipe.on('end', () => {
    if (readSingleLine) {
      resolve(data.split('\n').shift()!);
      return;
    }

    resolve(data);
  });
});

const readValueFromUser = (): Promise<string> => ux.prompt('Value', {
  type: 'mask',
});

export default (opts?: InputOptions): Promise<string> => {
  if (opts?.useSTDIN) {
    return readValueFromSTDIN(opts.readSingleLine);
  }

  return readValueFromUser();
};
