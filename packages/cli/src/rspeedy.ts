import {
  access,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import { CliError, errorMessage } from './errors.js';
import type {
  CliServices,
  CommandResult,
  RunningCommand,
} from './process.js';

export const DEFAULT_DEV_SERVER_HOST = '127.0.0.1';
export const DEFAULT_DEV_SERVER_PORT = 5969;
export const DEFAULT_LYNX_BUNDLE = 'main.lynx.bundle';

const LYNX_CONFIG_FILES = [
  'lynx.config.ts',
  'lynx.config.mts',
  'lynx.config.js',
  'lynx.config.mjs',
  'lynx.config.cjs',
] as const;

const QRCODE_PLUGIN_NAME = 'lynx:rsbuild:qrcode';

export interface DevServerHandle {
  readonly process?: RunningCommand;
  readonly started: boolean;
  readonly url: string;
}

export async function ensureRspeedyDevServer(
  projectRoot: string,
  port: number,
  services: CliServices,
): Promise<DevServerHandle> {
  const url = developmentBundleUrl(port);
  if (await bundleIsAvailable(url, services)) {
    if (await ownedDevServerIsRunning(projectRoot, port)) {
      return { started: false, url };
    }
    throw new CliError(
      'JTX_DEV_SERVER_CONFLICT',
      `Port ${port} is serving a Lynx bundle that is not owned by this Jilatax project.`,
      {
        hint: `Stop the other server or run again with another port, such as --port ${port + 1}.`,
      },
    );
  }

  const rspeedy = await resolveRspeedyBinary(projectRoot);
  const baseConfig = await resolveLynxConfig(projectRoot);
  const devConfig = await writeDevelopmentConfig(
    projectRoot,
    baseConfig,
    port,
  );
  services.log(`Starting Rspeedy at ${DEFAULT_DEV_SERVER_HOST}:${port}...`);
  const processHandle = services.start(
    rspeedy,
    ['dev', '--config', devConfig],
    { cwd: projectRoot, stdio: 'inherit' },
  );
  const markerPath = devServerMarkerPath(projectRoot);
  void processHandle.exited
    .finally(async () => {
      await rm(markerPath, { force: true });
    })
    .catch(() => {});

  let processResult: CommandResult | undefined;
  let processError: unknown;
  void processHandle.exited.then(
    (result) => {
      processResult = result;
    },
    (error: unknown) => {
      processError = error;
    },
  );

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (processError !== undefined) {
      throw new CliError(
        'JTX_COMMAND_FAILED',
        `Rspeedy could not start: ${errorMessage(processError)}`,
        { cause: processError },
      );
    }
    if (processResult !== undefined) {
      throw new CliError(
        'JTX_COMMAND_FAILED',
        `Rspeedy stopped before the bundle was ready (exit ${processResult.code}).`,
      );
    }
    if (await bundleIsAvailable(url, services)) {
      if (processHandle.pid !== undefined) {
        await writeFile(
          markerPath,
          `${JSON.stringify({
            pid: processHandle.pid,
            port,
            projectRoot,
          }, null, 2)}\n`,
          'utf8',
        );
      }
      return { process: processHandle, started: true, url };
    }
    await services.sleep(500);
  }

  processHandle.kill();
  await rm(markerPath, { force: true });
  throw new CliError(
    'JTX_DEV_SERVER_TIMEOUT',
    `Rspeedy did not serve ${DEFAULT_LYNX_BUNDLE} on port ${port}.`,
    {
      hint: 'Fix the Rspeedy compilation error, then run the Android command again.',
    },
  );
}

export async function buildAndSyncLynxBundle(
  projectRoot: string,
  services: CliServices,
): Promise<string> {
  const rspeedy = await resolveRspeedyBinary(projectRoot);
  const configPath = await resolveLynxConfig(projectRoot);
  services.log('Building the packaged Lynx bundle...');
  const result = await services.execute(
    rspeedy,
    ['build', '--config', configPath],
    { cwd: projectRoot, stdio: 'inherit' },
  );
  assertSuccessfulRspeedyBuild(result);

  const outputRoot = resolve(projectRoot, 'dist');
  const outputBundle = resolve(outputRoot, DEFAULT_LYNX_BUNDLE);
  await assertNonEmptyFile(
    outputBundle,
    'JTX_BUNDLE_MISSING',
    `Rspeedy did not create dist/${DEFAULT_LYNX_BUNDLE}.`,
  );

  const androidAssets = resolve(projectRoot, '.jilatax', 'android-assets');
  await mkdir(androidAssets, { recursive: true });
  await cp(outputRoot, androidAssets, {
    dereference: true,
    filter(source) {
      const pathFromOutput = relative(outputRoot, source);
      return pathFromOutput.split(sep)[0] !== '.rsbuild';
    },
    force: true,
    recursive: true,
  });

  const packagedBundle = resolve(androidAssets, DEFAULT_LYNX_BUNDLE);
  await assertNonEmptyFile(
    packagedBundle,
    'JTX_BUNDLE_MISSING',
    `Unable to synchronize ${DEFAULT_LYNX_BUNDLE} into Android assets.`,
  );
  return packagedBundle;
}

export function developmentBundleUrl(port: number): string {
  return `http://${DEFAULT_DEV_SERVER_HOST}:${port}/${DEFAULT_LYNX_BUNDLE}`;
}

async function bundleIsAvailable(
  url: string,
  services: CliServices,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await services.fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) return false;
    return (await response.arrayBuffer()).byteLength > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveRspeedyBinary(projectRoot: string): Promise<string> {
  const binary = resolve(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'rspeedy.cmd' : 'rspeedy',
  );
  if (await pathExists(binary)) return binary;

  throw new CliError(
    'JTX_RSPEDY_MISSING',
    'The local Rspeedy executable is missing.',
    { hint: 'Install the project dependencies before running this command.' },
  );
}

async function ownedDevServerIsRunning(
  projectRoot: string,
  port: number,
): Promise<boolean> {
  try {
    const marker = JSON.parse(
      await readFile(devServerMarkerPath(projectRoot), 'utf8'),
    ) as { pid?: unknown; port?: unknown; projectRoot?: unknown };
    if (
      marker.projectRoot !== projectRoot ||
      marker.port !== port ||
      typeof marker.pid !== 'number' ||
      !Number.isInteger(marker.pid) ||
      marker.pid < 1
    ) {
      return false;
    }
    process.kill(marker.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function devServerMarkerPath(projectRoot: string): string {
  return resolve(projectRoot, '.jilatax', 'dev-server.json');
}

async function resolveLynxConfig(projectRoot: string): Promise<string> {
  for (const configFile of LYNX_CONFIG_FILES) {
    const configPath = resolve(projectRoot, configFile);
    if (await pathExists(configPath)) return configPath;
  }

  throw new CliError(
    'JTX_CONFIG_INVALID',
    'No Lynx configuration file was found.',
    { hint: 'Create lynx.config.ts at the project root.' },
  );
}

async function writeDevelopmentConfig(
  projectRoot: string,
  baseConfig: string,
  port: number,
): Promise<string> {
  const generatedRoot = resolve(projectRoot, '.jilatax');
  const configPath = resolve(generatedRoot, 'lynx.dev.config.ts');
  await mkdir(dirname(configPath), { recursive: true });

  const relativeConfig = relative(generatedRoot, baseConfig)
    .split(sep)
    .join('/');
  const importSpecifier = relativeConfig.startsWith('.')
    ? relativeConfig
    : `./${relativeConfig}`;
  const source = [
    `import baseConfigModule from ${JSON.stringify(importSpecifier)};`,
    '',
    'const baseConfig =',
    '  (baseConfigModule as { default?: Record<string, unknown> }).default ??',
    '  (baseConfigModule as Record<string, unknown>);',
    'const baseServer =',
    '  (baseConfig.server as Record<string, unknown> | undefined) ?? {};',
    'const basePlugins = Array.isArray(baseConfig.plugins)',
    '    ? baseConfig.plugins',
    '    : [];',
    '',
    'export default {',
    '  ...baseConfig,',
    '  plugins: basePlugins.filter(',
    '    (plugin) =>',
    '      (plugin as { name?: string } | null | undefined)?.name !==',
    `      ${JSON.stringify(QRCODE_PLUGIN_NAME)},`,
    '  ),',
    '  server: {',
    '    ...baseServer,',
    `    host: ${JSON.stringify(DEFAULT_DEV_SERVER_HOST)},`,
    `    port: ${port},`,
    '    strictPort: true,',
    '  },',
    '};',
    '',
  ].join('\n');
  await writeFile(configPath, source, 'utf8');
  return configPath;
}

function assertSuccessfulRspeedyBuild(result: CommandResult): void {
  if (result.code === 0) return;
  throw new CliError(
    'JTX_BUNDLE_MISSING',
    `Rspeedy build failed with exit code ${result.code}.`,
  );
}

async function assertNonEmptyFile(
  filePath: string,
  code: 'JTX_BUNDLE_MISSING',
  message: string,
): Promise<void> {
  try {
    const file = await stat(filePath);
    if (file.isFile() && file.size > 0) return;
  } catch {
    // The error below includes the expected artifact path.
  }
  throw new CliError(code, message);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
