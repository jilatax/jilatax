import * as prompts from '@clack/prompts';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { stdin, stdout } from 'node:process';

import {
  createProject,
  defaultPackageId,
  normalizeDisplayName,
  normalizeProjectName,
  validatePackageId,
  type CreateProjectResult,
} from './generator.js';

export interface CreateCliServices {
  readonly create?: typeof createProject;
  readonly interactive?: boolean;
  readonly log?: (message: string) => void;
  readonly warn?: (message: string) => void;
}

interface CreateCliOptions {
  readonly displayName?: string;
  readonly install?: boolean;
  readonly packageId?: string;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
  readonly targetDirectory?: string;
}

class PromptCancelledError extends Error {}

export async function runCreateCli(
  args: readonly string[] = process.argv.slice(2),
  services: CreateCliServices = {},
): Promise<number> {
  const log = services.log ?? console.log;
  const warn = services.warn ?? console.error;
  try {
    const parsed = parseArgs(args);
    if (parsed.showHelp) {
      log(createHelpText());
      return 0;
    }
    if (parsed.showVersion) {
      log(await readCreatorVersion());
      return 0;
    }

    const interactive = services.interactive ?? (stdin.isTTY && stdout.isTTY);
    const options = interactive ? await promptForOptions(parsed) : nonInteractiveOptions(parsed);
    const generate = services.create ?? createProject;
    const progress = interactive && options.install ? startInstallProgress() : undefined;

    let result: CreateProjectResult;
    try {
      result = await generate({
        displayName: options.displayName,
        install: options.install,
        packageId: options.packageId,
        ...(progress === undefined ? {} : { silentInstall: true }),
        targetDirectory: options.targetDirectory,
      });
    } catch (error) {
      progress?.fail();
      throw error;
    }

    progress?.succeed();
    printResult(result, log, interactive);
    return 0;
  } catch (error) {
    if (error instanceof PromptCancelledError) return 0;
    warn(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function createHelpText(): string {
  return `Create an Android-first Jilatax application.

Usage:
  create-jilatax [directory] [options]

Options:
  --name <display-name>   Human-readable application name
  --package-id <id>       Android application ID
  --install               Install dependencies with Bun
  --skip-install          Generate without installing dependencies
  -h, --help              Show this help
  -V, --version           Show the installed creator version`;
}

function parseArgs(args: readonly string[]): CreateCliOptions {
  let displayName: string | undefined;
  let install: boolean | undefined;
  let packageId: string | undefined;
  let showHelp = false;
  let showVersion = false;
  let targetDirectory: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) continue;
    if (argument === '--install') install = true;
    else if (argument === '--skip-install' || argument === '--no-install') {
      install = false;
    } else if (argument === '--name') {
      displayName = readOptionValue(args, index, argument);
      index += 1;
    } else if (argument.startsWith('--name=')) {
      displayName = readInlineValue(argument, '--name');
    } else if (argument === '--package-id') {
      packageId = readOptionValue(args, index, argument);
      index += 1;
    } else if (argument.startsWith('--package-id=')) {
      packageId = readInlineValue(argument, '--package-id');
    } else if (argument === '--help' || argument === '-h') showHelp = true;
    else if (argument === '--version' || argument === '-V') showVersion = true;
    else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (targetDirectory === undefined) targetDirectory = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }

  return {
    ...(displayName === undefined ? {} : { displayName }),
    ...(install === undefined ? {} : { install }),
    ...(packageId === undefined ? {} : { packageId }),
    showHelp,
    showVersion,
    ...(targetDirectory === undefined ? {} : { targetDirectory }),
  };
}

async function promptForOptions(options: CreateCliOptions): Promise<RequiredProjectOptions> {
  await printWelcome(await readCreatorVersion());
  const targetDirectory =
    options.targetDirectory ??
    unwrapPrompt(
      await prompts.text({
        message: 'Where should the project be created?',
        placeholder: './my-jilatax-app',
        validate(value) {
          try {
            normalizeProjectNameFromDirectory(value ?? '');
          } catch (error) {
            return validationMessage(error);
          }
        },
      }),
    );
  const projectName = normalizeProjectNameFromDirectory(targetDirectory);
  const displayName = options.displayName ?? titleCase(projectName);
  const packageId =
    options.packageId ??
    unwrapPrompt(
      await prompts.text({
        initialValue: defaultPackageId(projectName),
        message: 'Android application ID',
        validate(value) {
          try {
            validatePackageId(value ?? '');
          } catch (error) {
            return validationMessage(error);
          }
        },
      }),
    );
  const install =
    options.install ??
    unwrapPrompt(
      await prompts.confirm({
        initialValue: false,
        message: 'Install dependencies with Bun?',
      }),
    );

  return {
    displayName: normalizeDisplayName(displayName),
    install,
    packageId: validatePackageId(packageId),
    targetDirectory,
  };
}

function nonInteractiveOptions(options: CreateCliOptions): RequiredProjectOptions {
  if (options.targetDirectory === undefined) {
    throw new Error('Project directory is required in a non-interactive terminal.');
  }
  const projectName = normalizeProjectNameFromDirectory(options.targetDirectory);
  return {
    displayName: normalizeDisplayName(options.displayName ?? titleCase(projectName)),
    install: options.install ?? false,
    packageId: validatePackageId(options.packageId ?? defaultPackageId(projectName)),
    targetDirectory: options.targetDirectory,
  };
}

interface RequiredProjectOptions {
  readonly displayName: string;
  readonly install: boolean;
  readonly packageId: string;
  readonly targetDirectory: string;
}

function normalizeProjectNameFromDirectory(directory: string): string {
  const normalized = directory.trim().replace(/[\\/]+$/gu, '');
  const basename = normalized.split(/[\\/]/u).at(-1) ?? '';
  return normalizeProjectName(basename);
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (prompts.isCancel(value)) {
    prompts.cancel('Project creation cancelled.');
    throw new PromptCancelledError();
  }
  return value;
}

function validationMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('-') || value.trim().length === 0) {
    throw new Error(`${option} requires a value.`);
  }
  return value.trim();
}

function readInlineValue(argument: string, option: string): string {
  const value = argument.slice(`${option}=`.length).trim();
  if (value.length === 0) throw new Error(`${option} requires a value.`);
  return value;
}

function titleCase(value: string): string {
  return value
    .split(/[-_.\s]+/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

async function printWelcome(version: string): Promise<void> {
  const reset = '\u001B[0m';
  const cyan = '\u001B[36m';
  const brightCyan = '\u001B[96m';
  const green = '\u001B[32m';
  const greenBackground = '\u001B[42m';
  const black = '\u001B[30m';
  const bold = '\u001B[1m';
  const dim = '\u001B[2m';
  const mascotTop = `${cyan} /\\_/\\ ${reset}`;
  const renderMascot = (eyes: string): string =>
    `${cyan} (${green}${eyes}${cyan}ᴗ${green}${eyes}${cyan}) ${reset}`;
  const welcome = [
    `${bold}${brightCyan}JilataX:${reset} ${dim}v${version}${reset}`,
    `${dim}Welcome.${reset} Build your next ${greenBackground}${black}Android${reset}-first app.`,
  ];
  const renderHeader = (eyes: string): string =>
    `${mascotTop}  ${welcome[0]}\n${renderMascot(eyes)}  ${welcome[1]}`;

  stdout.write(`\n${renderHeader('●')}`);
  await pause(160);
  stdout.write(`\r\u001B[2K${renderMascot('−')}  ${welcome[1]}`);
  await pause(90);
  stdout.write(`\r\u001B[2K${renderMascot('●')}  ${welcome[1]}\n\n`);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

interface InstallProgress {
  fail(): void;
  succeed(): void;
}

function startInstallProgress(): InstallProgress {
  const reset = '\u001B[0m';
  const brightCyan = '\u001B[96m';
  const dim = '\u001B[2m';
  const green = '\u001B[32m';
  const brightGreen = '\u001B[92m';
  const blue = '\u001B[94m';
  const magenta = '\u001B[95m';
  const muted = '\u001B[90m';
  const red = '\u001B[31m';
  const bold = '\u001B[1m';
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const cometPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1];
  let frameIndex = 0;

  const renderComet = (position: number): string => {
    const track = Array.from({ length: 9 }, (_, index) => {
      const distance = Math.abs(index - position);
      if (distance === 0) return `${brightGreen}◆`;
      if (distance === 1) return `${brightCyan}━`;
      if (distance === 2) return `${magenta}━`;
      if (distance === 3) return `${blue}·`;
      return `${muted}·`;
    }).join('');
    return `${track}${reset}`;
  };
  const renderInstalling = (): [string, string] => {
    const frame = frames[frameIndex % frames.length] ?? frames[0];
    const cometPosition = cometPositions[frameIndex % cometPositions.length] ?? 0;
    frameIndex += 1;
    return [
      `${brightCyan}${frame}${reset}  ${bold}Installing dependencies${reset}  ${renderComet(cometPosition)}`,
      `   ${dim}Bun is assembling your ${reset}${brightCyan}JilataX${reset}${dim} project…${reset}`,
    ];
  };
  const redraw = (lines: readonly [string, string]): void => {
    stdout.write(`\r\u001B[2K${lines[0]}\n\r\u001B[2K${lines[1]}\u001B[1A\r`);
  };

  stdout.write('\u001B[?25l');
  redraw(renderInstalling());
  const timer = setInterval(() => {
    redraw(renderInstalling());
  }, 90);

  const finish = (lines: readonly [string, string]): void => {
    clearInterval(timer);
    stdout.write(`\r\u001B[2K${lines[0]}\n\r\u001B[2K${lines[1]}\n\u001B[?25h`);
  };

  return {
    fail() {
      finish([
        `${red}×${reset}  ${bold}Dependency installation failed${reset}`,
        `   ${dim}Review the error above, then run bun install in your project.${reset}`,
      ]);
    },
    succeed() {
      finish([
        `${green}✓${reset}  ${bold}Dependencies installed${reset}  ${green}━━━━━━━━━${reset}`,
        `   ${dim}Your ${reset}${brightCyan}JilataX${reset}${dim} project is ready.${reset}`,
      ]);
    },
  };
}

function printResult(
  result: CreateProjectResult,
  log: (message: string) => void,
  interactive: boolean,
): void {
  const lines = [
    '🛠️ Next steps:',
    `  cd ${formatProjectDirectory(result.projectDirectory)}`,
    ...(result.installed ? [] : ['  bun install']),
    '  bun run dev',
    '',
    '🤖 Android:',
    '  bun run run:android',
    '  bun run create:aab',
  ];
  const message = lines.join('\n');
  const farewell = `Good luck out there, ${result.projectName}! 🎉`;

  if (interactive) {
    prompts.note(message, 'Result');
    prompts.outro(farewell);
    return;
  }

  log(`${message}\n\n${farewell}`);
}

function formatProjectDirectory(projectDirectory: string): string {
  const relativeDirectory = path.relative(process.cwd(), projectDirectory);
  const cwdPath =
    relativeDirectory.length === 0
      ? '.'
      : relativeDirectory.startsWith('..') || path.isAbsolute(relativeDirectory)
        ? relativeDirectory
        : `.${path.sep}${relativeDirectory}`;
  const homeRelative = path.relative(homedir(), projectDirectory);
  const homePath =
    homeRelative.length === 0
      ? '~'
      : homeRelative.startsWith('..') || path.isAbsolute(homeRelative)
        ? undefined
        : `~/${homeRelative.split(path.sep).join('/')}`;
  const shortestPath =
    homePath !== undefined && homePath.length < cwdPath.length ? homePath : cwdPath;

  return /\s/u.test(shortestPath) ? JSON.stringify(shortestPath) : shortestPath;
}

async function readCreatorVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: unknown;
  };
  return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
}
