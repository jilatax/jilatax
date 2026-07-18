import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import {
  createHelpText,
  createProject,
  runCreateCli,
} from 'create-jilatax';

const require = createRequire(import.meta.url);
const cjs = require('create-jilatax');

assert.equal(typeof createProject, 'function');
assert.equal(typeof runCreateCli, 'function');
assert.equal(typeof createHelpText, 'function');
assert.equal(typeof cjs.createProject, 'function');
assert.equal(typeof cjs.runCreateCli, 'function');
assert.equal(typeof cjs.createHelpText, 'function');

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'create-jilatax-smoke-'));

try {
  await testGeneratedProject(temporaryRoot);
  await testDottedProjectName(temporaryRoot);
  await testExistingTargetRefusal(temporaryRoot);
  await testInjectedInstaller(temporaryRoot);
  await testCli(temporaryRoot);
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

console.log('smoke test passed');

async function testDottedProjectName(root) {
  const projectDirectory = path.join(root, 'sample.mobile-app');
  await createProject({ targetDirectory: projectDirectory });
  const appJson = await readJson(path.join(projectDirectory, 'app.json'));

  assert.equal(appJson.jilatax.slug, 'sample-mobile-app');
  assert.equal(appJson.jilatax.scheme, 'sample.mobile-app');
  assert.equal(appJson.jilatax.android.package, 'com.example.sample_mobile_app');
}

async function testGeneratedProject(root) {
  const projectDirectory = path.join(root, 'sample-app');
  const result = await createProject({
    displayName: 'Sample Android App',
    install: false,
    packageId: 'dev.jilatax.sample',
    targetDirectory: projectDirectory,
  });

  assert.deepEqual(result, {
    displayName: 'Sample Android App',
    installed: false,
    packageId: 'dev.jilatax.sample',
    projectDirectory,
    projectName: 'sample-app',
  });

  const packageJson = await readJson(path.join(projectDirectory, 'package.json'));
  assert.equal(packageJson.name, 'sample-app');
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.deepEqual(packageJson.scripts, {
    dev: 'rspeedy dev',
    build: 'rspeedy build',
    typecheck: 'tsc -b',
    'run:android': 'jilatax run:android',
    'create:aab': 'jilatax create:aab',
  });
  assert.equal(packageJson.dependencies?.jilatax, '^0.0.6');
  assert.equal(typeof packageJson.dependencies?.['@lynx-js/react'], 'string');
  assert.equal(packageJson.devDependencies?.['@jilatax/cli'], '^0.0.9');
  assert.equal(
    packageJson.devDependencies?.['@lynx-js/qrcode-rsbuild-plugin'],
    '^0.4.4',
  );
  assert.equal(typeof packageJson.devDependencies?.['@lynx-js/rspeedy'], 'string');

  for (const dependencyName of [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]) {
    assert.doesNotMatch(dependencyName, /sparkling/iu);
  }

  const appJson = await readJson(path.join(projectDirectory, 'app.json'));
  assert.deepEqual(Object.keys(appJson).sort(), ['$schema', 'jilatax']);
  assert.equal(appJson.jilatax.name, 'Sample Android App');
  assert.equal(appJson.jilatax.slug, 'sample-app');
  assert.equal(appJson.jilatax.version, '1.0.0');
  assert.equal(appJson.jilatax.icon, './assets/icon.png');
  assert.equal(appJson.jilatax.splash.image, './assets/splash-icon.png');
  assert.equal(appJson.jilatax.splash.imageWidth, 96);
  assert.equal(appJson.jilatax.splash.resizeMode, 'contain');
  assert.equal(appJson.jilatax.splash.backgroundColor, '#041A17');
  assert.equal(appJson.jilatax.android.package, 'dev.jilatax.sample');
  assert.equal(appJson.jilatax.android.versionCode, 1);
  assert.deepEqual(appJson.jilatax.android.adaptiveIcon, {
    backgroundColor: '#E8FFF2',
    foregroundImage: './assets/icon.png',
  });

  const androidProperties = await readFile(
    path.join(projectDirectory, 'android', 'jilatax.properties'),
    'utf8',
  );
  assert.match(androidProperties, /^jilatax\.name=Sample Android App$/mu);
  assert.match(androidProperties, /^jilatax\.android\.package=dev\.jilatax\.sample$/mu);

  const settings = await readFile(
    path.join(projectDirectory, 'android', 'settings.gradle.kts'),
    'utf8',
  );
  assert.match(settings, /rootProject\.name = "sample-app"/u);
  assert.match(settings, /include\(":app", ":jilatax"\)/u);
  assert.match(settings, /node_modules\/jilatax\/android/u);

  const appGradle = await readFile(
    path.join(projectDirectory, 'android', 'app', 'build.gradle.kts'),
    'utf8',
  );
  assert.match(appGradle, /\.jilatax\/android-assets/u);
  assert.match(appGradle, /\.jilatax\/android-res/u);
  assert.match(appGradle, /implementation\(project\(":jilatax"\)\)/u);
  assert.doesNotMatch(appGradle, /sparkling/iu);

  const lynxConfig = await readFile(
    path.join(projectDirectory, 'lynx.config.ts'),
    'utf8',
  );
  assert.match(lynxConfig, /@lynx-js\/qrcode-rsbuild-plugin/u);
  assert.match(lynxConfig, /pluginQRCode/u);
  assert.match(lynxConfig, /\?fullscreen=true/u);

  const mainManifest = await readFile(
    path.join(projectDirectory, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  assert.match(mainManifest, /dev\.jilatax\.android\.JilataxApplication/u);
  assert.match(mainManifest, /dev\.jilatax\.android\.JilataxActivity/u);
  assert.match(mainManifest, /android:usesCleartextTraffic="false"/u);

  const debugManifest = await readFile(
    path.join(projectDirectory, 'android', 'app', 'src', 'debug', 'AndroidManifest.xml'),
    'utf8',
  );
  assert.match(debugManifest, /android:usesCleartextTraffic="true"/u);

  const projectFiles = await listFiles(projectDirectory);
  assert(projectFiles.includes('.gitignore'));
  assert(projectFiles.includes('assets/icon.png'));
  assert(projectFiles.includes('assets/splash-icon.png'));
  assert(
    projectFiles.includes(
      '.jilatax/android-res/drawable/jilatax_splash_icon.xml',
    ),
  );
  assert(
    projectFiles.includes(
      '.jilatax/android-res/mipmap-anydpi-v26/jilatax_launcher.xml',
    ),
  );
  assert(!projectFiles.includes('gitignore'));
  assert(!projectFiles.some((file) => file.startsWith('node_modules/')));
  assert(!projectFiles.some((file) => file.startsWith('.git/')));
  assert(!projectFiles.some((file) => file.startsWith('dist/')));
  assert(!projectFiles.some((file) => file.endsWith('.tmpl')));
  assert(!projectFiles.some((file) => file.endsWith('.base64')));

  const allGeneratedText = await readGeneratedText(projectDirectory, projectFiles);
  assert.doesNotMatch(allGeneratedText, /\{\{[A-Za-z][A-Za-z0-9]*\}\}/u);
  assert.doesNotMatch(allGeneratedText, /sparkling(?:-app-cli|-debug-tool)?/iu);

  const gradlewPath = path.join(projectDirectory, 'android', 'gradlew');
  const gradlew = await readFile(gradlewPath, 'utf8');
  assert.match(gradlew, /^#!\/bin\/sh/u);
  await access(path.join(projectDirectory, 'android', 'gradlew.bat'));
  if (process.platform !== 'win32') {
    assert.notEqual((await stat(gradlewPath)).mode & 0o111, 0);
  }

  const wrapperJar = await readFile(
    path.join(projectDirectory, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar'),
  );
  assert(wrapperJar.length > 20_000);
  assert.deepEqual([...wrapperJar.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const wrapperProperties = await readFile(
    path.join(projectDirectory, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties'),
    'utf8',
  );
  assert.match(wrapperProperties, /gradle-8\.11\.1-bin\.zip/u);
}

async function testExistingTargetRefusal(root) {
  const targetDirectory = path.join(root, 'existing-app');
  await mkdir(targetDirectory);
  const sentinel = path.join(targetDirectory, 'keep.txt');
  await writeFile(sentinel, 'keep me', 'utf8');

  await assert.rejects(
    createProject({ targetDirectory }),
    /Target directory already exists/u,
  );
  assert.equal(await readFile(sentinel, 'utf8'), 'keep me');
}

async function testInjectedInstaller(root) {
  const projectDirectory = path.join(root, 'installed-app');
  const installerCalls = [];
  const result = await createProject({
    install: true,
    installer: async (receivedDirectory) => {
      installerCalls.push(receivedDirectory);
      const packageJson = await readJson(path.join(receivedDirectory, 'package.json'));
      assert.equal(packageJson.name, 'installed-app');
    },
    targetDirectory: projectDirectory,
  });

  assert.deepEqual(installerCalls, [projectDirectory]);
  assert.equal(result.installed, true);
  assert.equal(result.projectDirectory, projectDirectory);
  assert.equal(await pathExists(path.join(projectDirectory, 'node_modules')), false);
}

async function testCli(root) {
  const helpLog = [];
  let creatorCalls = 0;
  const helpExitCode = await runCreateCli(['--help'], {
    create: async () => {
      creatorCalls += 1;
      throw new Error('help must not create a project');
    },
    interactive: false,
    log: (message) => helpLog.push(message),
  });
  assert.equal(helpExitCode, 0);
  assert.equal(creatorCalls, 0);
  assert.match(helpLog.join('\n'), /Usage:\s+create-jilatax/u);
  assert.equal(helpLog[0], createHelpText());

  const cliProject = path.join(root, 'cli-app');
  const cliCreateCalls = [];
  const cliLog = [];
  const cliWarnings = [];
  const cliExitCode = await runCreateCli(
    [
      cliProject,
      '--name',
      'CLI App',
      '--package-id=dev.jilatax.cliapp',
      '--skip-install',
    ],
    {
      create: async (options) => {
        cliCreateCalls.push(options);
        return {
          displayName: options.displayName,
          installed: options.install,
          packageId: options.packageId,
          projectDirectory: path.resolve(options.targetDirectory),
          projectName: 'cli-app',
        };
      },
      interactive: false,
      log: (message) => cliLog.push(message),
      warn: (message) => cliWarnings.push(message),
    },
  );
  assert.equal(cliExitCode, 0);
  assert.deepEqual(cliCreateCalls, [
    {
      displayName: 'CLI App',
      install: false,
      packageId: 'dev.jilatax.cliapp',
      targetDirectory: cliProject,
    },
  ]);
  assert.equal(cliWarnings.length, 0);
  assert.match(cliLog.join('\n'), /bun install/u);
  assert.match(cliLog.join('\n'), /bun run run:android/u);
  assert.match(cliLog.join('\n'), /bun run create:aab/u);

  const missingWarnings = [];
  assert.equal(
    await runCreateCli([], {
      interactive: false,
      warn: (message) => missingWarnings.push(message),
    }),
    1,
  );
  assert.deepEqual(missingWarnings, [
    'Project directory is required in a non-interactive terminal.',
  ]);

  const unknownWarnings = [];
  assert.equal(
    await runCreateCli(['--unknown'], {
      interactive: false,
      warn: (message) => unknownWarnings.push(message),
    }),
    1,
  );
  assert.deepEqual(unknownWarnings, ['Unknown option: --unknown']);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function listFiles(root, relativeDirectory = '') {
  const directory = path.join(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath.split(path.sep).join('/'));
    }
  }
  return files.sort();
}

async function readGeneratedText(root, files) {
  const contents = [];
  for (const file of files) {
    const buffer = await readFile(path.join(root, ...file.split('/')));
    if (!buffer.includes(0)) contents.push(buffer.toString('utf8'));
  }
  return contents.join('\n');
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
