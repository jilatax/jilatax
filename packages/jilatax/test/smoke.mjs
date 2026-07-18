import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  ANDROID_BUNDLE_SOURCE_EXTRA,
  DEFAULT_ANDROID_BUNDLE,
  JilataxConfigError,
  loadAppConfig,
  parseAppConfig,
  resolveAndroidBundleSource,
  resolveAndroidProjectPath,
  resolveAppSchemaPath,
  serializeAndroidProjectConfig,
  syncAndroidProjectConfig,
} from 'jilatax';

const rawConfig = {
  $schema: './node_modules/jilatax/schema/app.schema.json',
  jilatax: {
    name: 'Text Expo',
    icon: './assets/icon.png',
    splash: {
      backgroundColor: '#208AEF',
      image: './assets/splash.png',
      imageWidth: 76,
      resizeMode: 'contain',
    },
    android: {
      package: 'com.example.textexpo',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-foreground.png',
      },
    },
  },
};

const parsed = parseAppConfig(rawConfig);
assert.equal(parsed.$schema, rawConfig.$schema);
assert.equal(parsed.jilatax.slug, 'text-expo');
assert.equal(parsed.jilatax.version, '1.0.0');
assert.equal(parsed.jilatax.orientation, 'portrait');
assert.equal(parsed.jilatax.scheme, 'text-expo');
assert.equal(parsed.jilatax.android.versionCode, 1);
assert.equal(parsed.jilatax.android.predictiveBackGestureEnabled, false);
const serializedAndroidConfig = serializeAndroidProjectConfig(parsed);
assert.match(serializedAndroidConfig, /^jilatax\.name=Text Expo$/mu);
assert.match(
  serializedAndroidConfig,
  /^jilatax\.android\.package=com\.example\.textexpo$/mu,
);
assert.match(
  serializedAndroidConfig,
  /^jilatax\.splash\.backgroundColor=#208AEF$/mu,
);

assert.throws(
  () =>
    parseAppConfig({
      jilatax: {
        name: 'Broken',
        android: { package: 'Not.A.Package' },
      },
    }),
  JilataxConfigError,
);
assert.throws(
  () =>
    parseAppConfig({
      jilatax: {
        name: 'Escaping asset',
        icon: '../secret.png',
        android: { package: 'com.example.safe' },
      },
    }),
  JilataxConfigError,
);

const temporaryProject = await mkdtemp(path.join(tmpdir(), 'jilatax-config-'));
try {
  const assetsDirectory = path.join(temporaryProject, 'assets');
  await mkdir(assetsDirectory);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwQYVQAAAABJRU5ErkJggg==',
    'base64',
  );
  await Promise.all([
    writeFile(path.join(assetsDirectory, 'icon.png'), png),
    writeFile(path.join(assetsDirectory, 'splash.png'), png),
    writeFile(path.join(assetsDirectory, 'android-foreground.png'), png),
  ]);
  await writeFile(
    path.join(temporaryProject, 'app.json'),
    JSON.stringify(rawConfig),
    'utf8',
  );
  const loaded = await loadAppConfig(temporaryProject);
  assert.equal(loaded.config.jilatax.android.package, 'com.example.textexpo');
  assert.equal(loaded.configPath, path.join(temporaryProject, 'app.json'));
  const synced = await syncAndroidProjectConfig(
    temporaryProject,
    loaded.config,
  );
  assert.equal(
    await readFile(synced.propertiesPath, 'utf8'),
    serializeAndroidProjectConfig(loaded.config),
  );
  assert.equal(
    path.relative(temporaryProject, synced.resourcesPath),
    path.join('.jilatax', 'android-res'),
  );
  assert.deepEqual(
    await readFile(
      path.join(
        synced.resourcesPath,
        'drawable-nodpi',
        'jilatax_icon_image.png',
      ),
    ),
    png,
  );
  assert.match(
    await readFile(
      path.join(
        synced.resourcesPath,
        'drawable',
        'jilatax_splash_icon.xml',
      ),
      'utf8',
    ),
    /android:width="76dp"/u,
  );
  assert.match(
    await readFile(
      path.join(
        synced.resourcesPath,
        'mipmap-anydpi-v26',
        'jilatax_launcher.xml',
      ),
      'utf8',
    ),
    /@drawable\/jilatax_adaptive_foreground/u,
  );
} finally {
  await rm(temporaryProject, { recursive: true, force: true });
}

assert.deepEqual(resolveAndroidBundleSource(), {
  kind: 'asset',
  value: DEFAULT_ANDROID_BUNDLE,
});
assert.deepEqual(
  resolveAndroidBundleSource({
    mode: 'development',
    developmentUrl: 'http://127.0.0.1:5969/main.lynx.bundle',
  }),
  {
    kind: 'remote',
    value: 'http://127.0.0.1:5969/main.lynx.bundle',
  },
);
assert.deepEqual(
  resolveAndroidBundleSource({
    mode: 'release',
    developmentUrl: 'http://127.0.0.1:5969/main.lynx.bundle',
  }),
  { kind: 'asset', value: DEFAULT_ANDROID_BUNDLE },
);
assert.throws(
  () =>
    resolveAndroidBundleSource({
      mode: 'development',
      developmentUrl: 'file:///tmp/main.lynx.bundle',
    }),
  JilataxConfigError,
);

const missingAssetProject = await mkdtemp(
  path.join(tmpdir(), 'jilatax-missing-asset-'),
);
try {
  await assert.rejects(
    syncAndroidProjectConfig(missingAssetProject, parsed),
    /Android image asset does not exist: \.\/assets\/icon\.png/u,
  );
} finally {
  await rm(missingAssetProject, { recursive: true, force: true });
}

const androidProjectPath = resolveAndroidProjectPath();
const androidBuildFile = await readFile(
  resolveAndroidProjectPath('build.gradle.kts'),
  'utf8',
);
const androidBundleSource = await readFile(
  resolveAndroidProjectPath(
    'src/main/java/dev/jilatax/android/JilataxBundleSource.kt',
  ),
  'utf8',
);
assert.equal(existsSync(androidProjectPath), true);
assert.equal(androidBuildFile.includes('sparkling-debug-tool'), false);
assert.equal(androidBuildFile.includes('debugImplementation'), false);
assert.equal(androidBundleSource.includes(ANDROID_BUNDLE_SOURCE_EXTRA), true);
assert.equal(androidBundleSource.includes('SharedPreferences'), false);

const schemaPath = resolveAppSchemaPath();
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
assert.equal(existsSync(schemaPath), true);
assert.equal(schema.title, 'Jilatax application configuration');
const assetPathPattern = new RegExp(schema.$defs.assetPath.pattern);
const versionPattern = new RegExp(
  schema.$defs.jilataxConfig.properties.version.pattern,
);
for (const acceptedPath of [
  './assets/icon.png',
  'assets/android/icon.png',
]) {
  assert.equal(assetPathPattern.test(acceptedPath), true, acceptedPath);
  assert.doesNotThrow(() =>
    parseAppConfig({
      jilatax: {
        name: 'Accepted asset',
        icon: acceptedPath,
        android: { package: 'com.example.accepted' },
      },
    }),
  );
}
for (const rejectedPath of [
  '/tmp/icon.png',
  String.raw`C:\assets\icon.png`,
  String.raw`\\server\icon.png`,
  'https://example.com/icon.png',
  '../icon.png',
  'assets/../icon.png',
  'assets/',
]) {
  assert.equal(assetPathPattern.test(rejectedPath), false, rejectedPath);
  assert.throws(
    () =>
      parseAppConfig({
        jilatax: {
          name: 'Rejected asset',
          icon: rejectedPath,
          android: { package: 'com.example.rejected' },
        },
      }),
    JilataxConfigError,
  );
}
assert.equal(versionPattern.test('1.0.0-beta+1'), true);
assert.equal(
  parseAppConfig({
    jilatax: {
      name: 'Prerelease',
      version: '1.0.0-beta+1',
      android: { package: 'com.example.prerelease' },
    },
  }).jilatax.version,
  '1.0.0-beta+1',
);

const require = createRequire(import.meta.url);
const cjs = require('jilatax');
assert.equal(cjs.DEFAULT_ANDROID_BUNDLE, DEFAULT_ANDROID_BUNDLE);
assert.equal(
  cjs.parseAppConfig(rawConfig).jilatax.android.package,
  'com.example.textexpo',
);

console.log('smoke test passed');
