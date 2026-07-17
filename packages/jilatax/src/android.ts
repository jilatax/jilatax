import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JilataxConfigError } from './config.js';

export const DEFAULT_ANDROID_BUNDLE: string = 'main.lynx.bundle';
export const ANDROID_BUNDLE_SOURCE_EXTRA: string = 'dev.jilatax.bundleSource';

export type AndroidBundleMode = 'development' | 'packaged' | 'release';

export interface ResolveAndroidBundleSourceOptions {
  readonly mode?: AndroidBundleMode;
  readonly developmentUrl?: string;
}

export type AndroidBundleSource =
  | { readonly kind: 'asset'; readonly value: string }
  | { readonly kind: 'remote'; readonly value: string };

export function resolveAndroidBundleSource(
  options: ResolveAndroidBundleSourceOptions = {},
): AndroidBundleSource {
  const mode = options.mode ?? 'packaged';
  if (mode !== 'development' || options.developmentUrl === undefined) {
    return { kind: 'asset', value: DEFAULT_ANDROID_BUNDLE };
  }

  const developmentUrl = normalizeDevelopmentUrl(options.developmentUrl);
  return { kind: 'remote', value: developmentUrl };
}

export function resolveAndroidProjectPath(...segments: string[]): string {
  return resolveWithinPackageDirectory('android', segments);
}

export function resolveAppSchemaPath(): string {
  return resolveWithinPackageDirectory('schema', ['app.schema.json']);
}

function normalizeDevelopmentUrl(value: string): string {
  const candidate = value.trim();
  let url: URL;
  try {
    url = new URL(candidate);
  } catch (error) {
    throw new JilataxConfigError(
      'The Android development bundle URL must be a valid HTTP or HTTPS URL.',
      undefined,
      { cause: error },
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new JilataxConfigError(
      'The Android development bundle URL must use HTTP or HTTPS.',
    );
  }
  return candidate;
}

function resolveWithinPackageDirectory(
  directory: string,
  segments: readonly string[],
): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const directoryRoot = resolve(packageRoot, directory);
  const resolvedPath = resolve(directoryRoot, ...segments);
  if (
    resolvedPath !== directoryRoot &&
    !resolvedPath.startsWith(`${directoryRoot}${sep}`)
  ) {
    throw new JilataxConfigError(
      `The resolved path must stay inside the Jilatax ${directory} directory.`,
    );
  }
  return resolvedPath;
}
