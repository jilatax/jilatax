import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createAab, runAndroid } from './android.js';
import { CliError, errorMessage } from './errors.js';
import type { LiveReloadHandle } from './live-reload.js';
import {
  defaultCliServices,
  type CliServices,
  type RunningCommand,
} from './process.js';

export interface RunCliOptions {
  readonly services?: CliServices;
}

interface ParsedCommand {
  readonly command: 'create:aab' | 'run:android';
  readonly device?: string;
  readonly packaged: boolean;
  readonly port?: number;
  readonly projectRoot: string;
}

export async function runCli(
  args: readonly string[] = process.argv.slice(2),
  options: RunCliOptions = {},
): Promise<number> {
  const services = options.services ?? defaultCliServices;
  try {
    if (args.includes('--version') || args.includes('-V')) {
      services.log(await readCliVersion());
      return 0;
    }
    if (
      args.length === 0 ||
      args.includes('--help') ||
      args.includes('-h')
    ) {
      services.log(helpText());
      return 0;
    }

    const command = parseCommand(args);
    if (command.command === 'run:android') {
      const result = await runAndroid(
        {
          ...(command.device === undefined ? {} : { device: command.device }),
          packaged: command.packaged,
          ...(command.port === undefined ? {} : { port: command.port }),
          projectRoot: command.projectRoot,
        },
        services,
      );
      services.log(
        `Android app installed and launched on ${result.deviceSerial}.`,
      );
      services.log(`APK: ${result.apkPath}`);
      services.log(`Bundle source: ${result.bundleSource}`);
      if (result.liveReload !== undefined) {
        services.log(
          'Live reload is active. Successful source rebuilds refresh the Android app.',
        );
        services.log('Press Ctrl+C to stop the development session.');
        await waitForDevelopmentSession(
          result.liveReload,
          result.devServer,
        );
      }
      return 0;
    }

    const result = await createAab(
      { projectRoot: command.projectRoot },
      services,
    );
    services.log(`AAB: ${result.aabPath}`);
    if (result.signingConfigured) {
      services.log('Android release signing is configured.');
    } else {
      services.warn(
        'No complete android/keystore.properties configuration was detected; verify signing before Play Store upload.',
      );
    }
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      services.warn(`[${error.code}] ${error.message}`);
      if (error.hint !== undefined) services.warn(`Hint: ${error.hint}`);
      return error.exitCode;
    }
    services.warn(`Unexpected Jilatax CLI error: ${errorMessage(error)}`);
    return 1;
  }
}

export function helpText(): string {
  return `Jilatax Android CLI

Usage:
  jilatax run:android [options]
  jilatax create:aab [options]

Commands:
  run:android  Build, install, and live-reload on an Android device
  create:aab   Build the packaged Android App Bundle for release

Options:
  --device <serial>       Select an authorized Android device
  --port <number>         Rspeedy development port (default: 5969)
  --packaged              Launch the packaged bundle without a dev server
  --project-root <path>   Jilatax application root (default: current folder)
  -h, --help              Show this help
  -V, --version           Show the installed CLI version`;
}

async function waitForDevelopmentSession(
  liveReload: LiveReloadHandle,
  devServer: RunningCommand | undefined,
): Promise<void> {
  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    liveReload.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    if (devServer === undefined) {
      await liveReload.stopped;
      return;
    }
    const outcome = await Promise.race([
      liveReload.stopped.then(() => ({ source: 'reload' as const })),
      devServer.exited.then((result) => ({ result, source: 'server' as const })),
    ]);
    if (outcome.source === 'server' && !stopping) {
      liveReload.stop();
      await liveReload.stopped;
      throw new CliError(
        'JTX_COMMAND_FAILED',
        `Rspeedy stopped during the development session (exit ${outcome.result.code}).`,
      );
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

function parseCommand(args: readonly string[]): ParsedCommand {
  const command = args[0];
  if (command !== 'run:android' && command !== 'create:aab') {
    throw new CliError('JTX_USAGE', `Unknown command: ${command ?? ''}.`, {
      hint: 'Run jilatax --help to see the available commands.',
    });
  }

  let device: string | undefined;
  let packaged = false;
  let port: number | undefined;
  let projectRoot = process.cwd();

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;

    if (argument === '--packaged') {
      assertRunAndroidOption(command, argument);
      packaged = true;
      continue;
    }
    if (argument === '--device') {
      assertRunAndroidOption(command, argument);
      device = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument.startsWith('--device=')) {
      assertRunAndroidOption(command, '--device');
      device = readInlineOption(argument, '--device');
      continue;
    }
    if (argument === '--port') {
      assertRunAndroidOption(command, argument);
      port = readPort(readOptionValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument.startsWith('--port=')) {
      assertRunAndroidOption(command, '--port');
      port = readPort(readInlineOption(argument, '--port'));
      continue;
    }
    if (argument === '--project-root') {
      projectRoot = resolve(readOptionValue(args, index, argument));
      index += 1;
      continue;
    }
    if (argument.startsWith('--project-root=')) {
      projectRoot = resolve(readInlineOption(argument, '--project-root'));
      continue;
    }
    throw new CliError('JTX_USAGE', `Unknown option: ${argument}.`, {
      hint: 'Run jilatax --help to see the available options.',
    });
  }

  return {
    command,
    ...(device === undefined ? {} : { device }),
    packaged,
    ...(port === undefined ? {} : { port }),
    projectRoot,
  };
}

function assertRunAndroidOption(
  command: ParsedCommand['command'],
  option: string,
): void {
  if (command === 'run:android') return;
  throw new CliError(
    'JTX_USAGE',
    `${option} is only available with run:android.`,
  );
}

function readOptionValue(
  args: readonly string[],
  index: number,
  option: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('-') || value.trim().length === 0) {
    throw new CliError('JTX_USAGE', `${option} requires a value.`);
  }
  return value.trim();
}

function readInlineOption(argument: string, option: string): string {
  const value = argument.slice(`${option}=`.length).trim();
  if (value.length === 0) {
    throw new CliError('JTX_USAGE', `${option} requires a value.`);
  }
  return value;
}

function readPort(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new CliError('JTX_USAGE', '--port requires an integer.');
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new CliError(
      'JTX_USAGE',
      '--port must be an integer between 1 and 65535.',
    );
  }
  return port;
}

async function readCliVersion(): Promise<string> {
  const packagePath = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(
    await readFile(packagePath, 'utf8'),
  ) as { version?: unknown };
  return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
}
