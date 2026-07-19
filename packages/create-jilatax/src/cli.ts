import * as prompts from '@clack/prompts';
import { readFile } from 'node:fs/promises';
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
    const result = await generate({
      displayName: options.displayName,
      install: options.install,
      packageId: options.packageId,
      targetDirectory: options.targetDirectory,
    });
    printResult(result, log);
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
  printWelcome(await readCreatorVersion());
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

function printWelcome(version: string): void {
  const reset = '\u001B[0m';
  const cyan = '\u001B[36m';
  const greenBackground = '\u001B[42m';
  const black = '\u001B[30m';
  const mascot = `${cyan}◢▀▀▀   ▀▀▀◣${reset}\n${cyan}  ◉     ◉${reset}\n${cyan}    ╲▽╱${reset}`;
  const badge = `${greenBackground}${black} jilatax ${reset}`;

  console.log(`${mascot}  ${cyan}Jilatax:${reset}\n         Welcome to ${badge} ${cyan}v${version}${reset}!\n`);
}

function printResult(result: CreateProjectResult, log: (message: string) => void): void {
  const installStep = result.installed ? '' : '  bun install\n';
  log(`Created ${result.displayName} in ${result.projectDirectory}.

Next steps:
  cd ${JSON.stringify(result.projectDirectory)}
${installStep}  bun run run:android

Release bundle:
  bun run create:aab`);
}

async function readCreatorVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version?: unknown;
  };
  return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
}
