const { exec } = require('child_process');

/**
 * @param {string} command
 * @param {string[]} args
 * @param {Record<string, unknown>} opts
 * @returns {Promise<{stdout: Buffer; stderr: Buffer}>}
 */
module.exports = (command, args, opts) => new Promise((resolve, reject) => {
  if (process.env.DRY_RUN === 'true') {
    console.log(`Executing: ${command} ${args.join(' ')}`);
  }

  exec(
    `${command} ${args.join(' ')}`,
    opts,
    (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }

      resolve({ stdout, stderr });
    },
  );
});
