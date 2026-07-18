import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import {
  JilataxConfigError,
  type NormalizedJilataxConfig,
} from './config.js';

export interface SyncAndroidProjectConfigResult {
  readonly propertiesPath: string;
  readonly resourcesPath: string;
}

interface AndroidImageAsset {
  readonly height?: number;
  readonly resourceName: string;
  readonly width?: number;
}

const SUPPORTED_ANDROID_IMAGE_EXTENSIONS = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

const DEFAULT_ICON_BACKGROUND = '#E8FFF2';
const DEFAULT_SPLASH_BACKGROUND = '#0F172A';

export async function syncAndroidProjectConfig(
  projectRoot: string,
  config: NormalizedJilataxConfig,
): Promise<SyncAndroidProjectConfigResult> {
  const resolvedProjectRoot = resolve(projectRoot);
  const propertiesPath = resolve(
    resolvedProjectRoot,
    'android',
    'jilatax.properties',
  );
  const generatedRoot = resolve(resolvedProjectRoot, '.jilatax');
  const resourcesPath = resolve(generatedRoot, 'android-res');

  await mkdir(dirname(propertiesPath), { recursive: true });
  await mkdir(generatedRoot, { recursive: true });

  const stagingPath = await mkdtemp(join(generatedRoot, '.android-res-'));
  try {
    await writeAndroidResources(resolvedProjectRoot, stagingPath, config);
    await rm(resourcesPath, { force: true, recursive: true });
    await rename(stagingPath, resourcesPath);
  } catch (error) {
    await rm(stagingPath, { force: true, recursive: true });
    throw error;
  }

  await writeFile(
    propertiesPath,
    serializeAndroidProjectConfig(config),
    'utf8',
  );
  return { propertiesPath, resourcesPath };
}

export function serializeAndroidProjectConfig(
  config: NormalizedJilataxConfig,
): string {
  const { jilatax } = config;
  const properties: ReadonlyArray<readonly [string, string]> = [
    ['jilatax.name', jilatax.name],
    ['jilatax.slug', jilatax.slug],
    ['jilatax.version', jilatax.version],
    ['jilatax.orientation', jilatax.orientation],
    ['jilatax.scheme', jilatax.scheme],
    ['jilatax.userInterfaceStyle', jilatax.userInterfaceStyle],
    ['jilatax.android.package', jilatax.android.package],
    ['jilatax.android.versionCode', String(jilatax.android.versionCode)],
    [
      'jilatax.android.predictiveBackGestureEnabled',
      String(jilatax.android.predictiveBackGestureEnabled),
    ],
    [
      'jilatax.splash.backgroundColor',
      jilatax.splash?.backgroundColor ?? DEFAULT_SPLASH_BACKGROUND,
    ],
  ];

  return `${properties
    .map(([key, value]) => `${key}=${escapePropertyValue(value)}`)
    .join('\n')}\n`;
}

async function writeAndroidResources(
  projectRoot: string,
  resourcesRoot: string,
  config: NormalizedJilataxConfig,
): Promise<void> {
  const { jilatax } = config;
  const adaptiveIcon = jilatax.android.adaptiveIcon;

  const icon = await copyOptionalImageAsset(
    projectRoot,
    resourcesRoot,
    jilatax.icon,
    'jilatax_icon_image',
  );
  const adaptiveForeground = await copyOptionalImageAsset(
    projectRoot,
    resourcesRoot,
    adaptiveIcon?.foregroundImage ?? jilatax.icon,
    'jilatax_adaptive_foreground_image',
  );
  const adaptiveBackground = await copyOptionalImageAsset(
    projectRoot,
    resourcesRoot,
    adaptiveIcon?.backgroundImage,
    'jilatax_adaptive_background_image',
  );
  const adaptiveMonochrome = await copyOptionalImageAsset(
    projectRoot,
    resourcesRoot,
    adaptiveIcon?.monochromeImage,
    'jilatax_adaptive_monochrome_image',
  );
  const splash = await copyOptionalImageAsset(
    projectRoot,
    resourcesRoot,
    jilatax.splash?.image,
    'jilatax_splash_image',
  );

  await writeResource(
    resourcesRoot,
    'values/jilatax_colors.xml',
    colorsResource(
      adaptiveIcon?.backgroundColor ?? DEFAULT_ICON_BACKGROUND,
    ),
  );
  await writeResource(
    resourcesRoot,
    'drawable/jilatax_default_mark.xml',
    defaultMarkResource(),
  );
  await writeResource(
    resourcesRoot,
    'drawable/jilatax_adaptive_foreground.xml',
    centeredImageResource(adaptiveForeground, 72),
  );
  await writeResource(
    resourcesRoot,
    'drawable/jilatax_adaptive_monochrome.xml',
    centeredImageResource(adaptiveMonochrome ?? adaptiveForeground, 72),
  );
  if (adaptiveBackground !== undefined) {
    await writeResource(
      resourcesRoot,
      'drawable/jilatax_adaptive_background.xml',
      fillImageResource(adaptiveBackground),
    );
  }

  const splashWidth = jilatax.splash?.imageWidth ?? 96;
  await writeResource(
    resourcesRoot,
    'drawable/jilatax_splash_icon.xml',
    centeredImageResource(splash, splashWidth),
  );
  await writeResource(
    resourcesRoot,
    'drawable/jilatax_splash.xml',
    splashResource(),
  );
  await writeResource(
    resourcesRoot,
    'mipmap-anydpi/jilatax_launcher.xml',
    legacyLauncherResource(icon),
  );
  await writeResource(
    resourcesRoot,
    'mipmap-anydpi/jilatax_launcher_round.xml',
    legacyLauncherResource(icon),
  );

  const adaptiveBackgroundReference =
    adaptiveBackground === undefined
      ? '@color/jilatax_icon_background'
      : '@drawable/jilatax_adaptive_background';
  const adaptiveResource = adaptiveLauncherResource(
    adaptiveBackgroundReference,
    false,
  );
  await writeResource(
    resourcesRoot,
    'mipmap-anydpi-v26/jilatax_launcher.xml',
    adaptiveResource,
  );
  await writeResource(
    resourcesRoot,
    'mipmap-anydpi-v26/jilatax_launcher_round.xml',
    adaptiveResource,
  );

  if (adaptiveMonochrome !== undefined) {
    const monochromeResource = adaptiveLauncherResource(
      adaptiveBackgroundReference,
      true,
    );
    await writeResource(
      resourcesRoot,
      'mipmap-anydpi-v33/jilatax_launcher.xml',
      monochromeResource,
    );
    await writeResource(
      resourcesRoot,
      'mipmap-anydpi-v33/jilatax_launcher_round.xml',
      monochromeResource,
    );
  }
}

async function copyOptionalImageAsset(
  projectRoot: string,
  resourcesRoot: string,
  assetPath: string | undefined,
  resourceName: string,
): Promise<AndroidImageAsset | undefined> {
  if (assetPath === undefined) return undefined;

  const sourcePath = await resolveProjectAsset(projectRoot, assetPath);
  const extension = extname(sourcePath).toLowerCase();
  if (!SUPPORTED_ANDROID_IMAGE_EXTENSIONS.has(extension)) {
    throw new JilataxConfigError(
      `Android image asset ${assetPath} must be a PNG, JPEG, or WebP file.`,
    );
  }
  if (!(await stat(sourcePath)).isFile()) {
    throw new JilataxConfigError(
      `Android image asset is not a file: ${assetPath}`,
    );
  }

  const destinationDirectory = resolve(resourcesRoot, 'drawable-nodpi');
  await mkdir(destinationDirectory, { recursive: true });
  await copyFile(
    sourcePath,
    resolve(destinationDirectory, `${resourceName}${extension}`),
  );

  const dimensions = await readImageDimensions(sourcePath, extension);
  return { resourceName, ...dimensions };
}

async function resolveProjectAsset(
  projectRoot: string,
  assetPath: string,
): Promise<string> {
  const realProjectRoot = await realpath(projectRoot);
  let realAssetPath: string;
  try {
    realAssetPath = await realpath(resolve(projectRoot, assetPath));
  } catch (error) {
    throw new JilataxConfigError(
      `Android image asset does not exist: ${assetPath}`,
      undefined,
      { cause: error },
    );
  }

  const relativeAssetPath = relative(realProjectRoot, realAssetPath);
  if (
    relativeAssetPath === '..' ||
    relativeAssetPath.startsWith(`..${sep}`) ||
    isAbsolute(relativeAssetPath)
  ) {
    throw new JilataxConfigError(
      `Android image asset must stay inside the project: ${assetPath}`,
    );
  }
  return realAssetPath;
}

async function readImageDimensions(
  sourcePath: string,
  extension: string,
): Promise<{ readonly height?: number; readonly width?: number }> {
  if (extension !== '.png') return {};
  const header = await readFile(sourcePath);
  const pngSignature = '89504e470d0a1a0a';
  if (
    header.length < 24 ||
    header.subarray(0, 8).toString('hex') !== pngSignature
  ) {
    throw new JilataxConfigError(
      `Android PNG asset is invalid: ${sourcePath}`,
    );
  }
  return {
    height: header.readUInt32BE(20),
    width: header.readUInt32BE(16),
  };
}

async function writeResource(
  resourcesRoot: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const outputPath = resolve(resourcesRoot, ...relativePath.split('/'));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents, 'utf8');
}

function colorsResource(iconBackground: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="jilatax_icon_background">${iconBackground}</color>
</resources>
`;
}

function defaultMarkResource(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#38BDF8"
        android:pathData="M24,22 L84,22 L84,34 L62,34 L62,68 C62,82 53,90 39,90 C32,90 26,88 21,84 L27,73 C31,76 35,78 39,78 C46,78 50,74 50,67 L50,34 L24,34 Z" />
</vector>
`;
}

function centeredImageResource(
  image: AndroidImageAsset | undefined,
  width: number,
): string {
  const drawable =
    image === undefined
      ? '@drawable/jilatax_default_mark'
      : `@drawable/${image.resourceName}`;
  const height = scaledHeight(image, width);
  return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item
        android:width="${width}dp"
        android:height="${height}dp"
        android:drawable="${drawable}"
        android:gravity="center" />
</layer-list>
`;
}

function fillImageResource(image: AndroidImageAsset): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<bitmap
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:antialias="true"
    android:dither="true"
    android:filter="true"
    android:gravity="fill"
    android:src="@drawable/${image.resourceName}" />
`;
}

function legacyLauncherResource(icon: AndroidImageAsset | undefined): string {
  if (icon !== undefined) {
    return fillImageResource(icon);
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/jilatax_icon_background" />
    <item
        android:width="72dp"
        android:height="72dp"
        android:drawable="@drawable/jilatax_default_mark"
        android:gravity="center" />
</layer-list>
`;
}

function splashResource(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/jilatax_splash_background" />
    <item
        android:drawable="@drawable/jilatax_splash_icon"
        android:gravity="center" />
</layer-list>
`;
}

function adaptiveLauncherResource(
  background: string,
  includeMonochrome: boolean,
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="${background}" />
    <foreground android:drawable="@drawable/jilatax_adaptive_foreground" />${
      includeMonochrome
        ? '\n    <monochrome android:drawable="@drawable/jilatax_adaptive_monochrome" />'
        : ''
    }
</adaptive-icon>
`;
}

function scaledHeight(
  image: AndroidImageAsset | undefined,
  width: number,
): number {
  if (image?.width === undefined || image.height === undefined) return width;
  return Math.max(1, Math.round((width * image.height) / image.width));
}

function escapePropertyValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('=', '\\=')
    .replaceAll(':', '\\:');
}
