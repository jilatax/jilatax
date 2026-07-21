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
const svgPackageJson = require('@jilatax/svg/package.json');

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
  assert.equal(packageJson.dependencies?.jilatax, '^0.0.8');
  assert.equal(
    packageJson.dependencies?.['@jilatax/svg'],
    `^${svgPackageJson.version}`,
  );
  assert.equal(typeof packageJson.dependencies?.['@lynx-js/react'], 'string');
  assert.equal(packageJson.devDependencies?.['@jilatax/cli'], '^0.1.2');
  assert.equal(
    packageJson.devDependencies?.['@lynx-js/qrcode-rsbuild-plugin'],
    '^0.4.4',
  );
  assert.equal(typeof packageJson.devDependencies?.['@lynx-js/rspeedy'], 'string');

  const nodeTsconfig = await readJson(
    path.join(projectDirectory, 'tsconfig.node.json'),
  );
  assert.equal(
    nodeTsconfig.compilerOptions?.tsBuildInfoFile,
    './node_modules/.cache/jilatax/tsconfig.node.tsbuildinfo',
  );

  const appTsconfig = await readJson(
    path.join(projectDirectory, 'src', 'tsconfig.json'),
  );
  assert.equal(
    appTsconfig.compilerOptions?.tsBuildInfoFile,
    '../node_modules/.cache/jilatax/tsconfig.tsbuildinfo',
  );

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
  assert.equal(appJson.jilatax.icon, './public/assets/icon.png');
  assert.equal(appJson.jilatax.splash.image, './public/assets/splash-icon.png');
  assert.equal(appJson.jilatax.splash.imageWidth, 96);
  assert.equal(appJson.jilatax.splash.resizeMode, 'contain');
  assert.equal(appJson.jilatax.splash.backgroundColor, '#041A17');
  assert.equal(appJson.jilatax.android.package, 'dev.jilatax.sample');
  assert.equal(appJson.jilatax.android.versionCode, 1);
  assert.deepEqual(appJson.jilatax.android.adaptiveIcon, {
    backgroundColor: '#E8FFF2',
    foregroundImage: './public/assets/icon.png',
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
  assert.match(lynxConfig, /@jilatax\/svg\/plugin/u);
  assert.match(lynxConfig, /pluginJilataxSvg\(\)/u);
  assert.match(lynxConfig, /pluginQRCode/u);
  assert.match(lynxConfig, /\?fullscreen=true/u);
  assert.match(lynxConfig, /assetPrefix:\s*'asset:\/\/\/'/u);
  assert(
    lynxConfig.indexOf('pluginJilataxSvg()') <
      lynxConfig.indexOf('pluginReactLynx()'),
  );

  const mainManifest = await readFile(
    path.join(projectDirectory, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  assert.match(mainManifest, /dev\.jilatax\.app\.MainApplication/u);
  assert.match(mainManifest, /dev\.jilatax\.app\.MainActivity/u);
  assert.match(mainManifest, /dev\.jilatax\.android\.JilataxActivity/u);
  assert.match(mainManifest, /android:targetActivity="dev\.jilatax\.app\.MainActivity"/u);
  assert.match(mainManifest, /android:usesCleartextTraffic="false"/u);

  const androidStyles = await readFile(
    path.join(projectDirectory, 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'),
    'utf8',
  );
  assert.match(androidStyles, /<item name="android:forceDarkAllowed">false<\/item>/u);

  const debugManifest = await readFile(
    path.join(projectDirectory, 'android', 'app', 'src', 'debug', 'AndroidManifest.xml'),
    'utf8',
  );
  assert.match(debugManifest, /android:usesCleartextTraffic="true"/u);

  const projectFiles = await listFiles(projectDirectory);
  assert(projectFiles.includes('.gitignore'));
  assert(projectFiles.includes('AGENTS.md'));
  assert(projectFiles.includes('CLAUDE.md'));
  assert(projectFiles.includes('public/assets/icon.png'));
  assert(projectFiles.includes('public/assets/splash-icon.png'));
  assert(projectFiles.includes('public/fonts/jilatax.ttf'));
  assert(projectFiles.includes('src/assets/images/logo.png'));
  assert(projectFiles.includes('src/assets/icons/arrow-left.svg'));
  assert(projectFiles.includes('src/assets/icons/settings.svg'));
  assert(projectFiles.includes('src/app/App.tsx'));
  assert(projectFiles.includes('src/app/navigation.ts'));
  assert(projectFiles.includes('src/components/navigation/BottomBar.css'));
  assert(projectFiles.includes('src/components/navigation/BottomBar.tsx'));
  assert(projectFiles.includes('src/components/ui/Logo.tsx'));
  assert(projectFiles.includes('src/components/ui/buttons/SettingsButton.css'));
  assert(projectFiles.includes('src/components/ui/buttons/SettingsButton.tsx'));
  assert(projectFiles.includes('src/screens/AboutScreen.tsx'));
  assert(projectFiles.includes('src/screens/HomeScreen.tsx'));
  assert(projectFiles.includes('src/screens/MeScreen.tsx'));
  assert(projectFiles.includes('src/screens/settings/SettingScreen.css'));
  assert(projectFiles.includes('src/screens/settings/SettingScreen.tsx'));
  assert(projectFiles.includes('src/styles/global.css'));
  assert(projectFiles.includes('android/app/src/main/java/dev/jilatax/app/MainActivity.kt'));
  assert(projectFiles.includes('android/app/src/main/java/dev/jilatax/app/MainApplication.kt'));
  assert(!projectFiles.includes('src/App.tsx'));
  assert(!projectFiles.includes('src/App.tsx.tmpl'));
  assert(!projectFiles.includes('src/App.css'));
  assert(!projectFiles.includes('src/assets/icons/about.svg'));
  assert(!projectFiles.includes('src/assets/icons/home.svg'));
  assert(!projectFiles.includes('src/screens/SettingScreen.tsx'));
  assert(!projectFiles.includes('public/assets/jilatax-icon.png'));
  assert(!projectFiles.includes('public/fonts/JilataX.otf'));
  assert(!projectFiles.includes('src/components/ui/Brand.tsx'));
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

  const agentsSource = await readFile(
    path.join(projectDirectory, 'AGENTS.md'),
    'utf8',
  );
  assert.match(agentsSource, /This project is self-contained/u);
  assert.match(agentsSource, /treat them as independent projects/u);
  assert.doesNotMatch(agentsSource, /test-[12]/u);

  const claudeSource = await readFile(
    path.join(projectDirectory, 'CLAUDE.md'),
    'utf8',
  );
  assert.equal(claudeSource, '@AGENTS.md\n');

  const readmeSource = await readFile(
    path.join(projectDirectory, 'README.md'),
    'utf8',
  );
  const generatedGuidance = `${readmeSource}\n${agentsSource}\n${claudeSource}`;
  assert.doesNotMatch(generatedGuidance, /\bon1\b/iu);
  assert.doesNotMatch(generatedGuidance, /analizar(?:-base)?/iu);
  assert.doesNotMatch(generatedGuidance, /test-[12]/iu);

  const appSource = await readFile(
    path.join(projectDirectory, 'src', 'app', 'App.tsx'),
    'utf8',
  );
  assert.match(appSource, /useState\(false\)/u);
  assert.match(
    appSource,
    /from\s+['"]\.\.\/components\/ui\/buttons\/SettingsButton\.js['"]/u,
  );
  assert.match(appSource, /<HomeScreen\b/u);
  assert.match(appSource, /<AboutScreen\b/u);
  assert.match(appSource, /<MeScreen\b/u);
  assert.doesNotMatch(appSource, /\bonSettingsTap\b/u);
  assert.match(
    appSource,
    /<SettingScreen\b[^>]*\bonBack=\{handleNavigateBack\}/su,
  );
  assert.match(
    appSource,
    /\{isSettingsOpen\s*\?\s*null\s*:\s*\(\s*<SettingsButton\b[^>]*\bonTap=\{handleNavigateToSettings\}/su,
  );
  assert.equal((appSource.match(/<SettingsButton\b/gu) ?? []).length, 1);
  assert.match(
    appSource,
    /\{isSettingsOpen\s*\?\s*null\s*:\s*\(\s*<BottomBar\b/su,
  );
  assert.match(appSource, /useInitData/u);
  assert.match(appSource, /theme-\$\{appTheme\}/u);

  const navigationSource = await readFile(
    path.join(projectDirectory, 'src', 'app', 'navigation.ts'),
    'utf8',
  );
  assert.match(navigationSource, /id: 'home', label: 'Home'/u);
  assert.match(navigationSource, /id: 'about', label: 'About'/u);
  assert.match(navigationSource, /id: 'me', label: 'Me'/u);

  const bottomBarSource = await readFile(
    path.join(
      projectDirectory,
      'src',
      'components',
      'navigation',
      'BottomBar.tsx',
    ),
    'utf8',
  );
  assert.match(bottomBarSource, /APP_TABS\.map/u);
  assert.match(bottomBarSource, /bottom-bar__dot/u);
  assert.doesNotMatch(bottomBarSource, /SvgIconComponent/u);

  const homeScreenSource = await readFile(
    path.join(projectDirectory, 'src', 'screens', 'HomeScreen.tsx'),
    'utf8',
  );
  assert.match(homeScreenSource, /useMainThreadRef\(false\)/u);
  assert.match(
    homeScreenSource,
    /const handleScreenTap = \(\) => \{\s*'main thread';/u,
  );
  assert.match(homeScreenSource, /main-thread:bindtap=\{handleScreenTap\}/u);
  assert.match(homeScreenSource, /lynx\.querySelector\('#logo-emoji'\)/u);
  assert.match(homeScreenSource, /lynx\.querySelector\('#logo-image'\)/u);
  assert.match(homeScreenSource, /setStyleProperty\(/u);

  const aboutScreenSource = await readFile(
    path.join(projectDirectory, 'src', 'screens', 'AboutScreen.tsx'),
    'utf8',
  );

  const meScreenSource = await readFile(
    path.join(projectDirectory, 'src', 'screens', 'MeScreen.tsx'),
    'utf8',
  );
  assert.match(meScreenSource, /<text className="centered-message">Me<\/text>/u);

  for (const screenSource of [
    homeScreenSource,
    aboutScreenSource,
    meScreenSource,
  ]) {
    assert.doesNotMatch(screenSource, /\bSettingsButton\b/u);
    assert.doesNotMatch(screenSource, /\bonSettingsTap\b/u);
  }

  const settingsButtonSource = await readFile(
    path.join(
      projectDirectory,
      'src',
      'components',
      'ui',
      'buttons',
      'SettingsButton.tsx',
    ),
    'utf8',
  );
  assert.match(settingsButtonSource, /from '\.\.\/\.\.\/\.\.\/assets\/icons\/settings\.svg'/u);
  assert.match(settingsButtonSource, /bindtap=\{onTap\}/u);

  const settingScreenSource = await readFile(
    path.join(
      projectDirectory,
      'src',
      'screens',
      'settings',
      'SettingScreen.tsx',
    ),
    'utf8',
  );
  assert.match(settingScreenSource, /from '\.\.\/\.\.\/assets\/icons\/arrow-left\.svg'/u);
  assert.match(settingScreenSource, /bindtap=\{onBack\}/u);
  assert.match(settingScreenSource, />Setting<\/text>/u);

  const logoSource = await readFile(
    path.join(projectDirectory, 'src', 'components', 'ui', 'Logo.tsx'),
    'utf8',
  );
  assert.match(
    logoSource,
    /const iconWrapperStyle = \{[^}]*position:\s*'relative'[^}]*width:\s*'32px'[^}]*height:\s*'32px'/su,
  );
  assert.match(
    logoSource,
    /const textStyle = \{[^}]*position:\s*'absolute'/su,
  );
  assert.match(
    logoSource,
    /const imageStyle = \{[^}]*width:\s*'32px'[^}]*height:\s*'32px'[^}]*opacity:\s*0[^}]*position:\s*'absolute'/su,
  );
  assert.match(logoSource, /<image id="logo-image"/u);
  assert.match(logoSource, /<text id="logo-emoji"/u);

  const rspeedyTypes = await readFile(
    path.join(projectDirectory, 'src', 'rspeedy-env.d.ts'),
    'utf8',
  );
  assert.match(rspeedyTypes, /@jilatax\/svg\/types/u);

  const mainActivitySource = await readFile(
    path.join(
      projectDirectory,
      'android',
      'app',
      'src',
      'main',
      'java',
      'dev',
      'jilatax',
      'app',
      'MainActivity.kt',
    ),
    'utf8',
  );
  assert.match(mainActivitySource, /override fun initialDataJson\(\): String/u);
  assert.match(mainActivitySource, /"appTheme"/u);

  const mainApplicationSource = await readFile(
    path.join(
      projectDirectory,
      'android',
      'app',
      'src',
      'main',
      'java',
      'dev',
      'jilatax',
      'app',
      'MainApplication.kt',
    ),
    'utf8',
  );
  assert.match(mainApplicationSource, /override fun onConfigurationChanged/u);
  assert.match(mainApplicationSource, /Intent\.makeRestartActivityTask/u);

  const globalStyles = await readFile(
    path.join(projectDirectory, 'src', 'styles', 'global.css'),
    'utf8',
  );
  assert.match(globalStyles, /\.app-shell\.theme-dark/u);
  assert.doesNotMatch(globalStyles, /prefers-color-scheme/u);
  assert.match(globalStyles, /@font-face\s*\{[^}]*font-family:\s*jilatax/isu);
  assert.match(globalStyles, /src:\s*url\('\.\.\/\.\.\/public\/fonts\/jilatax\.ttf'\)/u);
  assert.match(globalStyles, /\.centered-message\s*\{[^}]*font-family:\s*jilatax/isu);

  const bottomBarStyles = await readFile(
    path.join(projectDirectory, 'src', 'components', 'navigation', 'BottomBar.css'),
    'utf8',
  );
  assert.match(bottomBarStyles, /\.bottom-bar/u);
  assert.match(bottomBarStyles, /border-radius:\s*999px/u);
  assert.match(bottomBarStyles, /\.theme-dark \.bottom-bar/u);
  assert.doesNotMatch(bottomBarStyles, /prefers-color-scheme/u);

  const allGeneratedText = await readGeneratedText(projectDirectory, projectFiles);
  assert.doesNotMatch(allGeneratedText, /\{\{[A-Za-z][A-Za-z0-9]*\}\}/u);
  assert.doesNotMatch(allGeneratedText, /sparkling(?:-app-cli|-debug-tool)?/iu);
  assert.doesNotMatch(allGeneratedText, /com\.example\.on1/iu);
  assert.doesNotMatch(allGeneratedText, /\/home\//u);
  assert.doesNotMatch(allGeneratedText, /\bon1\b/iu);

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
