import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

export type AppOrientation = 'default' | 'portrait' | 'landscape';

export type UserInterfaceStyle = 'automatic' | 'light' | 'dark';

export type SplashResizeMode = 'contain' | 'cover' | 'native';

export interface SplashConfig {
  readonly image?: string;
  readonly backgroundColor: string;
  readonly imageWidth?: number;
  readonly resizeMode?: SplashResizeMode;
}

export interface AndroidAdaptiveIconConfig {
  readonly foregroundImage: string;
  readonly backgroundColor: string;
  readonly backgroundImage?: string;
  readonly monochromeImage?: string;
}

export interface AndroidConfig {
  readonly package: string;
  readonly versionCode?: number;
  readonly adaptiveIcon?: AndroidAdaptiveIconConfig;
  readonly predictiveBackGestureEnabled?: boolean;
}

export interface JilataxAppConfig {
  readonly name: string;
  readonly slug?: string;
  readonly version?: string;
  readonly orientation?: AppOrientation;
  readonly icon?: string;
  readonly scheme?: string;
  readonly userInterfaceStyle?: UserInterfaceStyle;
  readonly splash?: SplashConfig;
  readonly android: AndroidConfig;
}

export interface JilataxConfig {
  readonly $schema?: string;
  readonly jilatax: JilataxAppConfig;
}

export interface NormalizedSplashConfig {
  readonly image?: string;
  readonly backgroundColor: string;
  readonly imageWidth?: number;
  readonly resizeMode?: SplashResizeMode;
}

export interface NormalizedAndroidAdaptiveIconConfig {
  readonly foregroundImage: string;
  readonly backgroundColor: string;
  readonly backgroundImage?: string;
  readonly monochromeImage?: string;
}

export interface NormalizedAndroidConfig {
  readonly package: string;
  readonly versionCode: number;
  readonly adaptiveIcon?: NormalizedAndroidAdaptiveIconConfig;
  readonly predictiveBackGestureEnabled: boolean;
}

export interface NormalizedJilataxAppConfig {
  readonly name: string;
  readonly slug: string;
  readonly version: string;
  readonly orientation: AppOrientation;
  readonly icon?: string;
  readonly scheme: string;
  readonly userInterfaceStyle: UserInterfaceStyle;
  readonly splash?: NormalizedSplashConfig;
  readonly android: NormalizedAndroidConfig;
}

export interface NormalizedJilataxConfig {
  readonly $schema?: string;
  readonly jilatax: NormalizedJilataxAppConfig;
}

export interface LoadedAppConfig {
  readonly config: NormalizedJilataxConfig;
  readonly configPath: string;
}

export class JilataxConfigError extends Error {
  readonly configPath: string | undefined;

  constructor(
    message: string,
    configPath?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'JilataxConfigError';
    this.configPath = configPath;
  }
}

const DEFAULT_VERSION = '1.0.0';
const DEFAULT_VERSION_CODE = 1;
const DEFAULT_ORIENTATION: AppOrientation = 'portrait';
const DEFAULT_USER_INTERFACE_STYLE: UserInterfaceStyle = 'automatic';

const ORIENTATIONS = new Set<AppOrientation>([
  'default',
  'portrait',
  'landscape',
]);
const USER_INTERFACE_STYLES = new Set<UserInterfaceStyle>([
  'automatic',
  'light',
  'dark',
]);
const SPLASH_RESIZE_MODES = new Set<SplashResizeMode>([
  'contain',
  'cover',
  'native',
]);
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/u;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/u;
const ANDROID_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const COLOR_PATTERN = /^#(?:[\dA-Fa-f]{6}|[\dA-Fa-f]{8})$/u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/u;
const URL_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:/u;

const TOP_LEVEL_KEYS = new Set(['$schema', 'jilatax']);
const JILATAX_KEYS = new Set([
  'name',
  'slug',
  'version',
  'orientation',
  'icon',
  'scheme',
  'userInterfaceStyle',
  'splash',
  'android',
]);
const SPLASH_KEYS = new Set([
  'image',
  'backgroundColor',
  'imageWidth',
  'resizeMode',
]);
const ANDROID_KEYS = new Set([
  'package',
  'versionCode',
  'adaptiveIcon',
  'predictiveBackGestureEnabled',
]);
const ADAPTIVE_ICON_KEYS = new Set([
  'foregroundImage',
  'backgroundColor',
  'backgroundImage',
  'monochromeImage',
]);

export function defineConfig(config: JilataxConfig): JilataxConfig {
  return config;
}

export function parseAppConfig(input: unknown): NormalizedJilataxConfig {
  const root = expectObject(input, 'app.json');
  assertKnownKeys(root, TOP_LEVEL_KEYS, 'app.json');
  const schema = readOptionalString(root.$schema, 'app.json.$schema');

  const rawConfig = expectObject(root.jilatax, 'jilatax');
  assertKnownKeys(rawConfig, JILATAX_KEYS, 'jilatax');

  const name = readRequiredString(rawConfig.name, 'jilatax.name');
  const slug = normalizeSlug(rawConfig.slug, name);
  const version = readVersion(rawConfig.version);
  const orientation = readOrientation(rawConfig.orientation);
  const icon = readOptionalAssetPath(rawConfig.icon, 'jilatax.icon');
  const scheme = readScheme(rawConfig.scheme, slug);
  const userInterfaceStyle = readUserInterfaceStyle(
    rawConfig.userInterfaceStyle,
  );
  const splash = parseSplash(rawConfig.splash);
  const android = parseAndroid(rawConfig.android);

  return {
    ...(schema === undefined ? {} : { $schema: schema }),
    jilatax: {
      name,
      slug,
      version,
      orientation,
      ...(icon === undefined ? {} : { icon }),
      scheme,
      userInterfaceStyle,
      ...(splash === undefined ? {} : { splash }),
      android,
    },
  };
}

export async function loadAppConfig(
  projectRoot: string = process.cwd(),
  configFile: string = 'app.json',
): Promise<LoadedAppConfig> {
  const configPath = isAbsolute(configFile)
    ? configFile
    : resolve(projectRoot, configFile);

  let source: string;
  try {
    source = await readFile(configPath, 'utf8');
  } catch (error) {
    throw new JilataxConfigError(
      `Unable to read app configuration at ${configPath}.`,
      configPath,
      { cause: error },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch (error) {
    throw new JilataxConfigError(
      `Invalid JSON in app configuration at ${configPath}.`,
      configPath,
      { cause: error },
    );
  }

  try {
    return {
      config: parseAppConfig(input),
      configPath,
    };
  } catch (error) {
    if (error instanceof JilataxConfigError) {
      throw new JilataxConfigError(error.message, configPath, {
        cause: error,
      });
    }
    throw error;
  }
}

function expectObject(value: unknown, fieldPath: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw configError(`${fieldPath} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  fieldPath: string,
): void {
  for (const key of Object.keys(value)) {
    if (!knownKeys.has(key)) {
      throw configError(`${fieldPath}.${key} is not a supported field.`);
    }
  }
}

function readRequiredString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw configError(`${fieldPath} must be a non-empty string.`);
  }
  return value.trim();
}

function readOptionalString(
  value: unknown,
  fieldPath: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return readRequiredString(value, fieldPath);
}

function normalizeSlug(value: unknown, name: string): string {
  const explicitSlug = readOptionalString(value, 'jilatax.slug');
  const slug = explicitSlug ?? slugify(name);
  if (!SLUG_PATTERN.test(slug)) {
    throw configError(
      'jilatax.slug must contain only lowercase letters, numbers, hyphens, or underscores.',
    );
  }
  return slug;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  if (slug.length === 0) {
    throw configError(
      'jilatax.slug is required when jilatax.name cannot produce a URL-safe slug.',
    );
  }
  return slug;
}

function readVersion(value: unknown): string {
  const version = readOptionalString(value, 'jilatax.version') ?? DEFAULT_VERSION;
  if (!VERSION_PATTERN.test(version)) {
    throw configError(
      'jilatax.version must be a semantic version such as 1.0.0.',
    );
  }
  return version;
}

function readOrientation(value: unknown): AppOrientation {
  if (value === undefined) {
    return DEFAULT_ORIENTATION;
  }
  if (typeof value !== 'string' || !ORIENTATIONS.has(value as AppOrientation)) {
    throw configError(
      'jilatax.orientation must be default, portrait, or landscape.',
    );
  }
  return value as AppOrientation;
}

function readScheme(value: unknown, slug: string): string {
  const scheme =
    readOptionalString(value, 'jilatax.scheme') ?? createDefaultScheme(slug);
  if (!SCHEME_PATTERN.test(scheme)) {
    throw configError('jilatax.scheme must be a valid URI scheme.');
  }
  return scheme;
}

function createDefaultScheme(slug: string): string {
  const candidate = slug.replace(/_/gu, '-');
  return /^[A-Za-z]/u.test(candidate) ? candidate : `jilatax-${candidate}`;
}

function readUserInterfaceStyle(value: unknown): UserInterfaceStyle {
  if (value === undefined) {
    return DEFAULT_USER_INTERFACE_STYLE;
  }
  if (
    typeof value !== 'string' ||
    !USER_INTERFACE_STYLES.has(value as UserInterfaceStyle)
  ) {
    throw configError(
      'jilatax.userInterfaceStyle must be automatic, light, or dark.',
    );
  }
  return value as UserInterfaceStyle;
}

function parseSplash(value: unknown): NormalizedSplashConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  const splash = expectObject(value, 'jilatax.splash');
  assertKnownKeys(splash, SPLASH_KEYS, 'jilatax.splash');

  const image = readOptionalAssetPath(splash.image, 'jilatax.splash.image');
  const backgroundColor = readOptionalColor(
    splash.backgroundColor,
    'jilatax.splash.backgroundColor',
  );
  if (backgroundColor === undefined) {
    throw configError('jilatax.splash.backgroundColor is required.');
  }
  const imageWidth = readOptionalPositiveInteger(
    splash.imageWidth,
    'jilatax.splash.imageWidth',
  );
  const resizeMode = readSplashResizeMode(splash.resizeMode);

  return {
    ...(image === undefined ? {} : { image }),
    backgroundColor,
    ...(imageWidth === undefined ? {} : { imageWidth }),
    ...(resizeMode === undefined ? {} : { resizeMode }),
  };
}

function parseAndroid(value: unknown): NormalizedAndroidConfig {
  const android = expectObject(value, 'jilatax.android');
  assertKnownKeys(android, ANDROID_KEYS, 'jilatax.android');

  const packageId = readRequiredString(
    android.package,
    'jilatax.android.package',
  );
  if (!ANDROID_PACKAGE_PATTERN.test(packageId)) {
    throw configError(
      'jilatax.android.package must be a lowercase reverse-DNS identifier such as com.example.app.',
    );
  }

  const versionCode =
    readOptionalPositiveInteger(
      android.versionCode,
      'jilatax.android.versionCode',
    ) ?? DEFAULT_VERSION_CODE;
  const adaptiveIcon = parseAdaptiveIcon(android.adaptiveIcon);
  const predictiveBackGestureEnabled = readOptionalBoolean(
    android.predictiveBackGestureEnabled,
    'jilatax.android.predictiveBackGestureEnabled',
  ) ?? false;

  return {
    package: packageId,
    versionCode,
    ...(adaptiveIcon === undefined ? {} : { adaptiveIcon }),
    predictiveBackGestureEnabled,
  };
}

function parseAdaptiveIcon(
  value: unknown,
): NormalizedAndroidAdaptiveIconConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  const adaptiveIcon = expectObject(
    value,
    'jilatax.android.adaptiveIcon',
  );
  assertKnownKeys(
    adaptiveIcon,
    ADAPTIVE_ICON_KEYS,
    'jilatax.android.adaptiveIcon',
  );

  const foregroundImage = readRequiredAssetPath(
    adaptiveIcon.foregroundImage,
    'jilatax.android.adaptiveIcon.foregroundImage',
  );
  const backgroundColor = readOptionalColor(
    adaptiveIcon.backgroundColor,
    'jilatax.android.adaptiveIcon.backgroundColor',
  );
  if (backgroundColor === undefined) {
    throw configError(
      'jilatax.android.adaptiveIcon.backgroundColor is required.',
    );
  }
  const backgroundImage = readOptionalAssetPath(
    adaptiveIcon.backgroundImage,
    'jilatax.android.adaptiveIcon.backgroundImage',
  );
  const monochromeImage = readOptionalAssetPath(
    adaptiveIcon.monochromeImage,
    'jilatax.android.adaptiveIcon.monochromeImage',
  );

  return {
    foregroundImage,
    backgroundColor,
    ...(backgroundImage === undefined ? {} : { backgroundImage }),
    ...(monochromeImage === undefined ? {} : { monochromeImage }),
  };
}

function readRequiredAssetPath(value: unknown, fieldPath: string): string {
  const assetPath = readRequiredString(value, fieldPath);
  validateAssetPath(assetPath, fieldPath);
  return assetPath;
}

function readOptionalAssetPath(
  value: unknown,
  fieldPath: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return readRequiredAssetPath(value, fieldPath);
}

function validateAssetPath(assetPath: string, fieldPath: string): void {
  const portablePath = assetPath.replace(/\\/gu, '/');
  const segments = portablePath.split('/');
  if (
    isAbsolute(assetPath) ||
    portablePath.startsWith('/') ||
    WINDOWS_ABSOLUTE_PATH_PATTERN.test(assetPath) ||
    URL_PATTERN.test(assetPath) ||
    segments.includes('..') ||
    portablePath.endsWith('/')
  ) {
    throw configError(
      `${fieldPath} must be a relative asset file path inside the project.`,
    );
  }
}

function readOptionalColor(
  value: unknown,
  fieldPath: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const color = readRequiredString(value, fieldPath);
  if (!COLOR_PATTERN.test(color)) {
    throw configError(
      `${fieldPath} must be a hexadecimal color such as #FFFFFF or #FFFFFFFF.`,
    );
  }
  return color;
}

function readSplashResizeMode(value: unknown): SplashResizeMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== 'string' ||
    !SPLASH_RESIZE_MODES.has(value as SplashResizeMode)
  ) {
    throw configError(
      'jilatax.splash.resizeMode must be contain, cover, or native.',
    );
  }
  return value as SplashResizeMode;
}

function readOptionalPositiveInteger(
  value: unknown,
  fieldPath: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw configError(`${fieldPath} must be a positive integer.`);
  }
  return value;
}

function readOptionalBoolean(
  value: unknown,
  fieldPath: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw configError(`${fieldPath} must be a boolean.`);
  }
  return value;
}

function configError(message: string): JilataxConfigError {
  return new JilataxConfigError(message);
}
