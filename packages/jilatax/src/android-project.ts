import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { NormalizedJilataxConfig } from './config.js';

export interface SyncAndroidProjectConfigResult {
  readonly propertiesPath: string;
}

export async function syncAndroidProjectConfig(
  projectRoot: string,
  config: NormalizedJilataxConfig,
): Promise<SyncAndroidProjectConfigResult> {
  const propertiesPath = resolve(
    projectRoot,
    'android',
    'jilatax.properties',
  );
  await mkdir(dirname(propertiesPath), { recursive: true });
  await writeFile(
    propertiesPath,
    serializeAndroidProjectConfig(config),
    'utf8',
  );
  return { propertiesPath };
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
      jilatax.splash?.backgroundColor ?? '#0F172A',
    ],
  ];

  return `${properties
    .map(([key, value]) => `${key}=${escapePropertyValue(value)}`)
    .join('\n')}\n`;
}

function escapePropertyValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('=', '\\=')
    .replaceAll(':', '\\:');
}
