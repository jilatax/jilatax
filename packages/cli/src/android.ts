import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  ANDROID_BUNDLE_SOURCE_EXTRA,
  DEFAULT_ANDROID_BUNDLE,
  JilataxConfigError,
  loadAppConfig,
  resolveAndroidBundleSource,
} from 'jilatax';

import { CliError, errorMessage } from './errors.js';
import {
  defaultCliServices,
  type CliServices,
  type CommandResult,
} from './process.js';
import {
  DEFAULT_DEV_SERVER_PORT,
  buildAndSyncLynxBundle,
  developmentBundleUrl,
  ensureRspeedyDevServer,
} from './rspeedy.js';

export interface AndroidDevice {
  readonly details: readonly string[];
  readonly serial: string;
  readonly state: string;
}

export interface RunAndroidOptions {
  readonly device?: string;
  readonly packaged?: boolean;
  readonly port?: number;
  readonly projectRoot?: string;
}

export interface RunAndroidResult {
  readonly apkPath: string;
  readonly bundleSource: string;
  readonly deviceSerial: string;
  readonly mode: 'development' | 'packaged';
  readonly startedDevServer: boolean;
}

export interface CreateAabOptions {
  readonly projectRoot?: string;
}

export interface CreateAabResult {
  readonly aabPath: string;
  readonly signingConfigured: boolean;
}

const JILATAX_ACTIVITY = 'dev.jilatax.android.JilataxActivity';
const BUNDLE_FAILURE_PATTERN =
  /code[:=\s]+10203|error occurred while fetching app bundle|failed to connect to \/?127\.0\.0\.1:\d+|failed to load remote bundle/iu;

export async function runAndroid(
  options: RunAndroidOptions = {},
  services: CliServices = defaultCliServices,
): Promise<RunAndroidResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const port = normalizePort(options.port);
  const config = await loadConfig(projectRoot);
  const packageId = config.jilatax.android.package;
  const androidProject = await resolveAndroidProject(projectRoot);
  const device = await selectConnectedDevice(
    await listAndroidDevices(projectRoot, services),
    options.device,
  );

  let startedDevServer = false;
  let devServerProcess:
    | Awaited<ReturnType<typeof ensureRspeedyDevServer>>['process']
    | undefined;

  try {
    let bundleSource = DEFAULT_ANDROID_BUNDLE;
    if (options.packaged !== true) {
      const devServer = await ensureRspeedyDevServer(
        projectRoot,
        port,
        services,
      );
      startedDevServer = devServer.started;
      devServerProcess = devServer.process;
      bundleSource = resolveAndroidBundleSource({
        developmentUrl: devServer.url,
        mode: 'development',
      }).value;
    } else {
      bundleSource = resolveAndroidBundleSource({ mode: 'packaged' }).value;
    }

    await buildAndSyncLynxBundle(projectRoot, services);
    services.log('Building the Android debug APK...');
    assertCommandSucceeded(
      await services.execute(
        androidProject.gradle,
        [':app:assembleDebug'],
        { cwd: androidProject.root, stdio: 'inherit' },
      ),
      'JTX_ANDROID_BUILD_FAILED',
      'The Android debug build failed.',
    );

    const apkPath = resolve(
      androidProject.root,
      'app',
      'build',
      'outputs',
      'apk',
      'debug',
      'app-debug.apk',
    );
    await assertArtifact(
      apkPath,
      'JTX_ANDROID_BUILD_FAILED',
      'Gradle completed without producing app-debug.apk.',
    );

    services.log(`Installing the APK on ${device.serial}...`);
    const installResult = await services.execute(
      'adb',
      ['-s', device.serial, 'install', '-r', apkPath],
      { cwd: projectRoot, stdio: 'pipe' },
    );
    assertCommandSucceeded(
      installResult,
      'JTX_INSTALL_FAILED',
      `Android installation failed on ${device.serial}.`,
    );
    if (!/\bSuccess\b/u.test(installResult.stdout + installResult.stderr)) {
      throw new CliError(
        'JTX_INSTALL_FAILED',
        `ADB did not confirm that ${packageId} was installed on ${device.serial}.`,
      );
    }

    if (options.packaged !== true) {
      await configureAdbReverse(device.serial, port, projectRoot, services);
    }

    await stopAndroidApp(device.serial, packageId, projectRoot, services);
    await launchAndroidApp(
      device.serial,
      packageId,
      bundleSource,
      projectRoot,
      services,
    );

    if (options.packaged !== true) {
      await verifyAdbReverse(device.serial, port, projectRoot, services);
    }
    await verifyAndroidProcess(
      device.serial,
      packageId,
      projectRoot,
      services,
    );

    return {
      apkPath,
      bundleSource,
      deviceSerial: device.serial,
      mode: options.packaged === true ? 'packaged' : 'development',
      startedDevServer,
    };
  } catch (error) {
    devServerProcess?.kill();
    throw error;
  }
}

export async function createAab(
  options: CreateAabOptions = {},
  services: CliServices = defaultCliServices,
): Promise<CreateAabResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  await loadConfig(projectRoot);
  const androidProject = await resolveAndroidProject(projectRoot);

  await buildAndSyncLynxBundle(projectRoot, services);
  services.log('Building the Android release bundle...');
  assertCommandSucceeded(
    await services.execute(
      androidProject.gradle,
      [':app:bundleRelease'],
      { cwd: androidProject.root, stdio: 'inherit' },
    ),
    'JTX_ANDROID_BUILD_FAILED',
    'The Android release bundle build failed.',
  );

  const aabPath = resolve(
    androidProject.root,
    'app',
    'build',
    'outputs',
    'bundle',
    'release',
    'app-release.aab',
  );
  await assertArtifact(
    aabPath,
    'JTX_AAB_MISSING',
    'Gradle completed without producing app-release.aab.',
  );

  return {
    aabPath,
    signingConfigured: await hasKeystoreProperties(androidProject.root),
  };
}

export function parseAdbDevices(output: string): AndroidDevice[] {
  const lines = output.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) =>
    line.trim().startsWith('List of devices attached'),
  );
  const deviceLines = headerIndex === -1 ? lines : lines.slice(headerIndex + 1);

  return deviceLines.flatMap((line) => {
    const fields = line.trim().split(/\s+/u).filter(Boolean);
    const serial = fields[0];
    const state = fields[1];
    if (
      serial === undefined ||
      state === undefined ||
      serial.startsWith('*')
    ) {
      return [];
    }
    return [{ details: fields.slice(2), serial, state }];
  });
}

export function selectAndroidDevice(
  devices: readonly AndroidDevice[],
  requestedSerial?: string,
): AndroidDevice {
  if (requestedSerial !== undefined) {
    const requested = devices.find(
      ({ serial }) => serial === requestedSerial.trim(),
    );
    if (requested === undefined) {
      throw new CliError(
        'JTX_DEVICE_UNAVAILABLE',
        `Android device ${requestedSerial} is not connected.`,
      );
    }
    if (requested.state !== 'device') {
      throw new CliError(
        'JTX_DEVICE_UNAVAILABLE',
        `Android device ${requested.serial} is ${requested.state}, not ready.`,
        { hint: 'Authorize the device and verify it with adb devices -l.' },
      );
    }
    return requested;
  }

  const readyDevices = devices.filter(({ state }) => state === 'device');
  if (readyDevices.length === 1 && readyDevices[0] !== undefined) {
    return readyDevices[0];
  }
  if (readyDevices.length > 1) {
    throw new CliError(
      'JTX_MULTIPLE_DEVICES',
      `More than one Android device is ready: ${readyDevices
        .map(({ serial }) => serial)
        .join(', ')}.`,
      { hint: 'Run again with --device <serial>.' },
    );
  }

  const connectedStates = devices
    .map(({ serial, state }) => `${serial} (${state})`)
    .join(', ');
  throw new CliError(
    'JTX_NO_DEVICE',
    connectedStates.length > 0
      ? `No authorized Android device is ready: ${connectedStates}.`
      : 'No Android device is connected.',
    { hint: 'Connect and authorize a device, then verify it with adb devices -l.' },
  );
}

async function loadConfig(projectRoot: string) {
  try {
    return (await loadAppConfig(projectRoot)).config;
  } catch (error) {
    if (error instanceof JilataxConfigError) {
      throw new CliError('JTX_CONFIG_INVALID', error.message, {
        cause: error,
        hint: 'Fix app.json before running the Android command.',
      });
    }
    throw error;
  }
}

async function listAndroidDevices(
  projectRoot: string,
  services: CliServices,
): Promise<AndroidDevice[]> {
  const result = await services.execute('adb', ['devices', '-l'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  assertCommandSucceeded(
    result,
    'JTX_DEVICE_UNAVAILABLE',
    'Unable to list Android devices with ADB.',
  );
  return parseAdbDevices(result.stdout);
}

async function selectConnectedDevice(
  devices: readonly AndroidDevice[],
  requestedSerial?: string,
): Promise<AndroidDevice> {
  return selectAndroidDevice(devices, requestedSerial);
}

async function resolveAndroidProject(projectRoot: string): Promise<{
  gradle: string;
  root: string;
}> {
  const root = resolve(projectRoot, 'android');
  const gradle = resolve(
    root,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  try {
    await access(gradle);
    await access(resolve(root, 'app'));
  } catch (error) {
    throw new CliError(
      'JTX_ANDROID_PROJECT_MISSING',
      'The Android project or Gradle wrapper is missing.',
      {
        cause: error,
        hint: 'Run this command from a Jilatax application root.',
      },
    );
  }
  return { gradle, root };
}

async function configureAdbReverse(
  serial: string,
  port: number,
  projectRoot: string,
  services: CliServices,
): Promise<void> {
  assertCommandSucceeded(
    await services.execute(
      'adb',
      ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`],
      { cwd: projectRoot, stdio: 'pipe' },
    ),
    'JTX_ADB_REVERSE_FAILED',
    `Unable to create the ADB reverse tunnel for port ${port}.`,
  );
  await verifyAdbReverse(serial, port, projectRoot, services);
}

async function verifyAdbReverse(
  serial: string,
  port: number,
  projectRoot: string,
  services: CliServices,
): Promise<void> {
  const result = await services.execute(
    'adb',
    ['-s', serial, 'reverse', '--list'],
    { cwd: projectRoot, stdio: 'pipe' },
  );
  assertCommandSucceeded(
    result,
    'JTX_ADB_REVERSE_FAILED',
    'Unable to verify the ADB reverse tunnel.',
  );
  const expected = `tcp:${port}`;
  const mappingExists = result.stdout.split(/\r?\n/u).some((line) => {
    const fields = line.trim().split(/\s+/u);
    return fields.at(-2) === expected && fields.at(-1) === expected;
  });
  if (!mappingExists) {
    throw new CliError(
      'JTX_ADB_REVERSE_FAILED',
      `ADB did not retain the ${expected} reverse tunnel.`,
      {
        hint: 'Reconnect the device, then run again or use --packaged.',
      },
    );
  }
}

async function stopAndroidApp(
  serial: string,
  packageId: string,
  projectRoot: string,
  services: CliServices,
): Promise<void> {
  assertCommandSucceeded(
    await services.execute(
      'adb',
      ['-s', serial, 'shell', 'am', 'force-stop', packageId],
      { cwd: projectRoot, stdio: 'pipe' },
    ),
    'JTX_LAUNCH_FAILED',
    `Unable to stop ${packageId} before launch.`,
  );
}

async function launchAndroidApp(
  serial: string,
  packageId: string,
  bundleSource: string,
  projectRoot: string,
  services: CliServices,
): Promise<void> {
  const result = await services.execute(
    'adb',
    [
      '-s',
      serial,
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      `${packageId}/${JILATAX_ACTIVITY}`,
      '--es',
      ANDROID_BUNDLE_SOURCE_EXTRA,
      bundleSource,
    ],
    { cwd: projectRoot, stdio: 'pipe' },
  );
  assertCommandSucceeded(
    result,
    'JTX_LAUNCH_FAILED',
    `Unable to launch ${packageId} on ${serial}.`,
  );
  if (!/^Status:\s+ok\s*$/imu.test(result.stdout + result.stderr)) {
    throw new CliError(
      'JTX_LAUNCH_FAILED',
      `Android did not confirm a successful launch of ${packageId}.`,
    );
  }
}

async function verifyAndroidProcess(
  serial: string,
  packageId: string,
  projectRoot: string,
  services: CliServices,
): Promise<void> {
  await services.sleep(2_500);
  const pidResult = await services.execute(
    'adb',
    ['-s', serial, 'shell', 'pidof', packageId],
    { cwd: projectRoot, stdio: 'pipe' },
  );
  const processId = pidResult.stdout.trim().split(/\s+/u)[0] ?? '';
  if (pidResult.code !== 0 || processId.length === 0) {
    throw new CliError(
      'JTX_LAUNCH_FAILED',
      `${packageId} stopped immediately after launch.`,
    );
  }

  const logResult = await services.execute(
    'adb',
    ['-s', serial, 'logcat', `--pid=${processId}`, '-d', '-v', 'brief'],
    { cwd: projectRoot, stdio: 'pipe' },
  );
  if (logResult.code !== 0) return;
  const failedLine = (logResult.stdout + logResult.stderr)
    .split(/\r?\n/u)
    .find((line) => BUNDLE_FAILURE_PATTERN.test(line));
  if (failedLine !== undefined) {
    throw new CliError(
      'JTX_LAUNCH_FAILED',
      `Lynx reported a bundle failure: ${failedLine.trim()}`,
      {
        hint: `Verify ${developmentBundleUrl(DEFAULT_DEV_SERVER_PORT)} or run with --packaged.`,
      },
    );
  }
}

function normalizePort(value: number | undefined): number {
  const port = value ?? DEFAULT_DEV_SERVER_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new CliError(
      'JTX_USAGE',
      'The development server port must be an integer between 1 and 65535.',
    );
  }
  return port;
}

function assertCommandSucceeded(
  result: CommandResult,
  code:
    | 'JTX_ADB_REVERSE_FAILED'
    | 'JTX_ANDROID_BUILD_FAILED'
    | 'JTX_DEVICE_UNAVAILABLE'
    | 'JTX_INSTALL_FAILED'
    | 'JTX_LAUNCH_FAILED',
  message: string,
): void {
  if (result.code === 0) return;
  const details = `${result.stdout}\n${result.stderr}`.trim();
  throw new CliError(
    code,
    details.length > 0
      ? `${message} ${details}`
      : `${message} Exit code: ${result.code}.`,
  );
}

async function assertArtifact(
  artifactPath: string,
  code: 'JTX_AAB_MISSING' | 'JTX_ANDROID_BUILD_FAILED',
  message: string,
): Promise<void> {
  try {
    const artifact = await stat(artifactPath);
    if (artifact.isFile() && artifact.size > 0) return;
  } catch (error) {
    throw new CliError(code, message, { cause: error });
  }
  throw new CliError(code, message);
}

async function hasKeystoreProperties(androidRoot: string): Promise<boolean> {
  try {
    const content = await readFile(
      resolve(androidRoot, 'keystore.properties'),
      'utf8',
    );
    return ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'].every(
      (key) => new RegExp(`^${key}\\s*=\\s*\\S+`, 'mu').test(content),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new CliError(
      'JTX_CONFIG_INVALID',
      `Unable to read Android signing configuration: ${errorMessage(error)}`,
      { cause: error },
    );
  }
}
