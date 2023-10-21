import { spawn } from 'node:child_process';

import { Args, Flags } from '@oclif/core';

import BaseCommand from '../base-command';
import getEnvVars from '../utils/get-env-vars';

const signals = [
  'SIGABRT',
  'SIGALRM',
  'SIGBREAK',
  'SIGBUS',
  'SIGCHLD',
  'SIGCONT',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINFO',
  'SIGINT',
  'SIGIO',
  'SIGIOT',
  'SIGKILL',
  'SIGLOST',
  'SIGPIPE',
  'SIGPOLL',
  'SIGPROF',
  'SIGPWR',
  'SIGQUIT',
  'SIGSEGV',
  'SIGSTKFLT',
  'SIGSTOP',
  'SIGSYS',
  'SIGTERM',
  'SIGTRAP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGUNUSED',
  'SIGURG',
  'SIGUSR1',
  'SIGUSR2',
  'SIGVTALRM',
  'SIGWINCH',
  'SIGXCPU',
  'SIGXFSZ',
];

export default class Exec extends BaseCommand<typeof Exec> {
  static description = 'Execute a command, injecting config into the environment.';

  static strict = false;

  static examples = [
    '<%= config.bin %> <%= command.id %> -- ./server',
    '<%= config.bin %> <%= command.id %> --pristine -- ./server',
  ];

  static flags = {
    pristine: Flags.boolean({
      char: 'p',
      description: 'only use config managed by griffin; do not inherit existing environment variables',
    }),
  };

  static args = {
    separator: Args.string({
      name: 'separator',
      hidden: true,
      required: true,
      options: ['--'],
    }),
    command: Args.string({
      name: 'COMMAND',
      description: 'the command to execute',
      required: true,
    }),
    args: Args.string({
      name: 'args...',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const subArgs = this.argv.slice(2);
    let env: Record<string, string | undefined> = {};

    if (!this.flags.pristine) {
      env = {
        ...env,
        ...process.env,
      };
    }

    env = {
      ...env,
      ...(await getEnvVars(this.configFile.toParamDefinitions())),
    };

    const cmd = spawn(this.args.command, subArgs, {
      detached: true,
      stdio: 'inherit',
      env,
    });

    signals.forEach((sig) => process.on(sig, (signal) => cmd.kill(signal)));

    cmd.on('close', (code) => process.exit(code || 0));
  }
}
