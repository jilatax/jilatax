export {
  JilataxConfigError,
  defineConfig,
  loadAppConfig,
  parseAppConfig,
} from './config.js';
export type {
  AndroidAdaptiveIconConfig,
  AndroidConfig,
  AppOrientation,
  JilataxAppConfig,
  JilataxConfig,
  LoadedAppConfig,
  NormalizedAndroidAdaptiveIconConfig,
  NormalizedAndroidConfig,
  NormalizedJilataxAppConfig,
  NormalizedJilataxConfig,
  NormalizedSplashConfig,
  SplashConfig,
  SplashResizeMode,
  UserInterfaceStyle,
} from './config.js';

export {
  ANDROID_BUNDLE_SOURCE_EXTRA,
  DEFAULT_ANDROID_BUNDLE,
  resolveAndroidBundleSource,
  resolveAndroidProjectPath,
  resolveAppSchemaPath,
} from './android.js';

export {
  serializeAndroidProjectConfig,
  syncAndroidProjectConfig,
} from './android-project.js';
export type { SyncAndroidProjectConfigResult } from './android-project.js';
export type {
  AndroidBundleMode,
  AndroidBundleSource,
  ResolveAndroidBundleSourceOptions,
} from './android.js';
