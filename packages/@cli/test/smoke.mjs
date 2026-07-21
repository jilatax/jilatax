import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANDROID_BUNDLE_SOURCE_EXTRA,
  DEFAULT_ANDROID_BUNDLE,
} from 'jilatax';
import {
  CliError,
  createAab,
  parseAdbDevices,
  runAndroid,
  runCli,
  selectAndroidDevice,
} from '@jilatax/cli';

const parsedDevices = parseAdbDevices(`List of devices attached
emulator-5554\tdevice product:sdk model:Pixel device:emu
R58M123\tunauthorized usb:1-2
`);
assert.deepEqual(parsedDevices, [
  {
    details: ['product:sdk', 'model:Pixel', 'device:emu'],
    serial: 'emulator-5554',
    state: 'device',
  },
  {
    details: ['usb:1-2'],
    serial: 'R58M123',
    state: 'unauthorized',
  },
]);
assert.equal(selectAndroidDevice(parsedDevices).serial, 'emulator-5554');
assert.throws(
  () =>
    selectAndroidDevice([
      ...parsedDevices,
      { details: [], serial: 'second', state: 'device' },
    ]),
  (error) => error instanceof CliError && error.code === 'JTX_MULTIPLE_DEVICES',
);

const projectRoot = await mkdtemp(path.join(tmpdir(), 'jilatax-cli-'));
try {
  await createFixture(projectRoot);

  const development = createFakeServices(projectRoot, 'development');
  const runResult = await runAndroid(
    { projectRoot },
    development.services,
  );
  assert.equal(runResult.mode, 'development');
  assert.equal(runResult.startedDevServer, true);
  assert.equal(typeof runResult.devServer?.kill, 'function');
  assert.equal(typeof runResult.liveReload?.stop, 'function');
  assert.equal(
    runResult.bundleSource,
    'http://127.0.0.1:5969/main.lynx.bundle',
  );
  assert.equal(
    await readFile(
      path.join(
        projectRoot,
        '.jilatax/android-assets/main.lynx.bundle',
      ),
      'utf8',
    ),
    'fixture-bundle',
  );
  assert.equal(
    await readFile(
      path.join(
        projectRoot,
        '.jilatax/android-assets/static/font/fixture.ttf',
      ),
      'utf8',
    ),
    'fixture-font',
  );

  assertOrdered(development.events, [
    'adb:devices',
    'bundle:probe',
    'rspeedy:dev',
    'bundle:probe',
    'rspeedy:build',
    'gradle:assembleDebug',
    'adb:install',
    'adb:reverse:set',
    'adb:reverse:list',
    'adb:force-stop',
    'adb:start',
    'adb:reverse:list',
    'adb:pidof',
    'adb:logcat',
  ]);

  const generatedDevConfig = await readFile(
    path.join(projectRoot, '.jilatax/lynx.dev.config.ts'),
    'utf8',
  );
  assert.match(generatedDevConfig, /basePlugins\.filter/u);
  assert.match(generatedDevConfig, /lynx:rsbuild:qrcode/u);
  assert.equal(
    development.events.filter((event) => event === 'adb:start').length,
    1,
  );
  assert.ok(
    development.launchArgs.includes(ANDROID_BUNDLE_SOURCE_EXTRA),
  );
  assert.ok(development.launchArgs.includes(runResult.bundleSource));

  development.publishBundle('fixture-bundle-updated');
  await waitFor(
    () =>
      development.events.filter((event) => event === 'adb:start').length ===
      2,
    'Android live reload did not relaunch the fixture app.',
  );
  assert.equal(
    development.events.filter((event) => event === 'adb:reverse:set').length,
    2,
  );
  runResult.liveReload?.stop();
  await runResult.liveReload?.stopped;
  assert.equal(development.serverKilled, true);

  const conflict = createFakeServices(projectRoot, 'conflict');
  await assert.rejects(
    runAndroid({ projectRoot }, conflict.services),
    (error) =>
      error instanceof CliError && error.code === 'JTX_DEV_SERVER_CONFLICT',
  );
  assert.equal(conflict.events.includes('rspeedy:build'), false);
  assert.equal(conflict.events.includes('adb:start'), false);

  const reverseFailure = createFakeServices(projectRoot, 'reverse-failure');
  await assert.rejects(
    runAndroid({ projectRoot }, reverseFailure.services),
    (error) =>
      error instanceof CliError && error.code === 'JTX_ADB_REVERSE_FAILED',
  );
  assert.equal(reverseFailure.events.includes('adb:start'), false);
  assert.equal(reverseFailure.serverKilled, true);

  const packaged = createFakeServices(projectRoot, 'packaged');
  const packagedResult = await runAndroid(
    { packaged: true, projectRoot },
    packaged.services,
  );
  assert.equal(packagedResult.mode, 'packaged');
  assert.equal(packagedResult.startedDevServer, false);
  assert.equal(packagedResult.liveReload, undefined);
  assert.equal(packagedResult.bundleSource, DEFAULT_ANDROID_BUNDLE);
  assert.equal(packaged.events.includes('bundle:probe'), false);
  assert.equal(packaged.events.includes('rspeedy:dev'), false);
  assert.equal(packaged.events.includes('adb:reverse:set'), false);
  assert.equal(packaged.events.includes('adb:reverse:list'), false);
  assert.equal(
    packaged.events.filter((event) => event === 'adb:start').length,
    1,
  );
  assert.ok(packaged.launchArgs.includes(DEFAULT_ANDROID_BUNDLE));

  const release = createFakeServices(projectRoot, 'release');
  const aabResult = await createAab(
    { projectRoot },
    release.services,
  );
  assert.equal(aabResult.signingConfigured, false);
  assert.ok(aabResult.aabPath.endsWith('/app-release.aab'));
  assert.deepEqual(release.events, [
    'rspeedy:build',
    'gradle:bundleRelease',
  ]);
} finally {
  await rm(projectRoot, { force: true, recursive: true });
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const cliBin = fileURLToPath(new URL('../dist/bin.js', import.meta.url));
const cliOutput = [];
const cliWarnings = [];
const cliServices = createOutputServices(cliOutput, cliWarnings);
assert.equal(await runCli(['--help'], { services: cliServices }), 0);
assert.match(cliOutput.at(-1), /jilatax run:android/u);
assert.match(cliOutput.at(-1), /jilatax create:aab/u);
assert.equal(await runCli(['--version'], { services: cliServices }), 0);
assert.equal(cliOutput.at(-1), packageJson.version);
assert.equal(await runCli(['unknown'], { services: cliServices }), 1);
assert.match(cliWarnings.at(-2), /JTX_USAGE/u);

const binSource = await readFile(cliBin, 'utf8');
assert.ok(binSource.startsWith('#!/usr/bin/env node'));
assert.notEqual((await stat(cliBin)).mode & 0o111, 0);

assert.equal(packageJson.bin.jilatax, './dist/bin.js');
assert.equal(packageJson.dependencies.jilatax, '^0.0.8');
assert.equal('sparkling-app-cli' in packageJson.dependencies, false);
assert.equal('sparkling-debug-tool' in packageJson.dependencies, false);

const require = createRequire(import.meta.url);
const cjs = require('@jilatax/cli');
assert.equal(typeof cjs.runAndroid, 'function');
assert.equal(typeof cjs.createAab, 'function');

console.log('smoke test passed');

async function createFixture(root) {
  await mkdir(path.join(root, 'node_modules/.bin'), { recursive: true });
  await mkdir(path.join(root, 'android/app'), { recursive: true });
  await writeFile(
    path.join(root, 'app.json'),
    JSON.stringify({
      jilatax: {
        android: { package: 'dev.jilatax.fixture' },
        name: 'CLI Fixture',
      },
    }),
  );
  await writeFile(
    path.join(root, 'lynx.config.ts'),
    'export default {};\n',
  );
  const rspeedy = path.join(
    root,
    'node_modules/.bin',
    process.platform === 'win32' ? 'rspeedy.cmd' : 'rspeedy',
  );
  await writeFile(rspeedy, 'fixture\n');
  const gradle = path.join(
    root,
    'android',
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  await writeFile(gradle, 'fixture\n');
  if (process.platform !== 'win32') {
    await chmod(rspeedy, 0o755);
    await chmod(gradle, 0o755);
  }
}

function createFakeServices(root, mode) {
  const events = [];
  let serverStarted = mode === 'conflict';
  let serverKilled = false;
  let bundle = 'fixture-bundle';
  let launchArgs = [];

  const services = {
    async execute(command, args) {
      if (command === 'adb') {
        assertSelectedDevice(args);
        if (args[0] === 'devices') {
          events.push('adb:devices');
          return result('List of devices attached\nfixture-device\tdevice\n');
        }
        if (args.includes('install')) {
          events.push('adb:install');
          return result('Success\n');
        }
        if (args.includes('reverse') && args.includes('--list')) {
          events.push('adb:reverse:list');
          return mode === 'reverse-failure'
            ? result()
            : result('fixture-device tcp:5969 tcp:5969\n');
        }
        if (args.includes('reverse')) {
          events.push('adb:reverse:set');
          return result();
        }
        if (args.includes('force-stop')) {
          events.push('adb:force-stop');
          return result();
        }
        if (args.includes('start')) {
          events.push('adb:start');
          launchArgs = [...args];
          return result('Status: ok\n');
        }
        if (args.includes('pidof')) {
          events.push('adb:pidof');
          return result('1234\n');
        }
        if (args.includes('logcat')) {
          events.push('adb:logcat');
          return result();
        }
        throw new Error(`Unexpected adb call: ${args.join(' ')}`);
      }

      if (command.endsWith('rspeedy') || command.endsWith('rspeedy.cmd')) {
        assert.equal(args[0], 'build');
        events.push('rspeedy:build');
        await mkdir(path.join(root, 'dist/static/font'), { recursive: true });
        await writeFile(
          path.join(root, 'dist/main.lynx.bundle'),
          'fixture-bundle',
        );
        await writeFile(
          path.join(root, 'dist/static/font/fixture.ttf'),
          'fixture-font',
        );
        return result();
      }

      if (command.endsWith('gradlew') || command.endsWith('gradlew.bat')) {
        if (args.includes(':app:assembleDebug')) {
          events.push('gradle:assembleDebug');
          const apk = path.join(
            root,
            'android/app/build/outputs/apk/debug/app-debug.apk',
          );
          await mkdir(path.dirname(apk), { recursive: true });
          await writeFile(apk, 'fixture-apk');
          return result();
        }
        if (args.includes(':app:bundleRelease')) {
          events.push('gradle:bundleRelease');
          const aab = path.join(
            root,
            'android/app/build/outputs/bundle/release/app-release.aab',
          );
          await mkdir(path.dirname(aab), { recursive: true });
          await writeFile(aab, 'fixture-aab');
          return result();
        }
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    },
    async fetch() {
      events.push('bundle:probe');
      return serverStarted
        ? new Response(bundle, { headers: { etag: `"${bundle}"` } })
        : new Response('', { status: 503 });
    },
    log() {},
    async sleep() {},
    start(command, args) {
      assert.ok(command.endsWith('rspeedy') || command.endsWith('rspeedy.cmd'));
      assert.deepEqual(args.slice(0, 2), ['dev', '--config']);
      assert.ok(mode === 'development' || mode === 'reverse-failure');
      events.push('rspeedy:dev');
      serverStarted = true;
      return {
        exited: new Promise(() => {}),
        kill() {
          serverKilled = true;
          return true;
        },
      };
    },
    warn() {},
  };

  return {
    events,
    publishBundle(nextBundle) {
      bundle = nextBundle;
    },
    get launchArgs() {
      return launchArgs;
    },
    get serverKilled() {
      return serverKilled;
    },
    services,
  };
}

function assertSelectedDevice(args) {
  if (args[0] === 'devices') return;
  assert.deepEqual(args.slice(0, 2), ['-s', 'fixture-device']);
}

function result(stdout = '', stderr = '', code = 0) {
  return { code, signal: null, stderr, stdout };
}

function createOutputServices(output, warnings) {
  return {
    async execute() {
      throw new Error('The output-only CLI fixture cannot execute commands.');
    },
    async fetch() {
      throw new Error('The output-only CLI fixture cannot fetch.');
    },
    log(message) {
      output.push(message);
    },
    async sleep() {},
    start() {
      throw new Error('The output-only CLI fixture cannot start commands.');
    },
    warn(message) {
      warnings.push(message);
    },
  };
}

function assertOrdered(actual, expected) {
  let previous = -1;
  for (const event of expected) {
    const index = actual.indexOf(event, previous + 1);
    assert.notEqual(index, -1, `Missing ordered event ${event}: ${actual}`);
    previous = index;
  }
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
