import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

import { CliError, errorMessage } from './errors.js';

export type CommandStdio = 'inherit' | 'pipe';

export interface ExecuteCommandOptions {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: CommandStdio;
}

export interface CommandResult {
  readonly code: number;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;
  readonly stdout: string;
}

export interface RunningCommand {
  readonly exited: Promise<CommandResult>;
  readonly pid?: number;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface CliServices {
  readonly execute: (
    command: string,
    args: readonly string[],
    options: ExecuteCommandOptions,
  ) => Promise<CommandResult>;
  readonly fetch: typeof globalThis.fetch;
  readonly log: (message: string) => void;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly start: (
    command: string,
    args: readonly string[],
    options: ExecuteCommandOptions,
  ) => RunningCommand;
  readonly warn: (message: string) => void;
}

const activeCommands = new Set<ChildProcess>();

export const defaultCliServices: CliServices = {
  execute: executeCommand,
  fetch: globalThis.fetch.bind(globalThis),
  log(message) {
    console.log(message);
  },
  sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
  start: startCommand,
  warn(message) {
    console.warn(message);
  },
};

export function executeCommand(
  command: string,
  args: readonly string[],
  options: ExecuteCommandOptions,
): Promise<CommandResult> {
  return createCommand(command, args, options).exited;
}

export function startCommand(
  command: string,
  args: readonly string[],
  options: ExecuteCommandOptions,
): RunningCommand {
  return createCommand(command, args, options);
}

function createCommand(
  command: string,
  args: readonly string[],
  options: ExecuteCommandOptions,
): RunningCommand {
  const stdio = options.stdio ?? 'inherit';
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell:
      process.platform === 'win32' && /\.(?:bat|cmd)$/iu.test(command),
    stdio: stdio === 'pipe' ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
  };
  const child = spawn(command, [...args], spawnOptions);
  activeCommands.add(child);

  let stdout = '';
  let stderr = '';
  if (stdio === 'pipe') {
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
  }

  const exited = new Promise<CommandResult>((resolve, reject) => {
    child.once('error', (error) => {
      activeCommands.delete(child);
      reject(
        new CliError(
          'JTX_COMMAND_FAILED',
          `Unable to start ${command}: ${errorMessage(error)}`,
          { cause: error },
        ),
      );
    });
    child.once('close', (code, signal) => {
      activeCommands.delete(child);
      resolve({
        code: code ?? 1,
        signal,
        stderr,
        stdout,
      });
    });
  });

  return {
    exited,
    ...(child.pid === undefined ? {} : { pid: child.pid }),
    kill(signal = 'SIGTERM') {
      return child.kill(signal);
    },
  };
}
