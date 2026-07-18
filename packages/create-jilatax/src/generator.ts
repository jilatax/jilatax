import { spawn } from 'node:child_process';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseAppConfig,
  syncAndroidProjectConfig,
  type NormalizedJilataxConfig,
} from 'jilatax';

export interface CreateProjectOptions {
  readonly displayName?: string;
  readonly install?: boolean;
  readonly installer?: ProjectInstaller;
  readonly packageId?: string;
  readonly targetDirectory: string;
}

export interface CreateProjectResult {
  readonly displayName: string;
  readonly installed: boolean;
  readonly packageId: string;
  readonly projectDirectory: string;
  readonly projectName: string;
}

export type ProjectInstaller = (projectDirectory: string) => Promise<void>;

const JILATAX_CLI_VERSION = '^0.0.9';
const JILATAX_VERSION = '^0.0.6';
const LYNX_QRCODE_PLUGIN_VERSION = '^0.4.4';
const LYNX_REACT_VERSION = '^0.116.2';
const LYNX_TYPES_VERSION = '^3.7.0';
const REACT_PLUGIN_VERSION = '^0.12.7';
const RSPEEDY_VERSION = '^0.13.3';

const TEXT_TEMPLATE_FILES = new Set([
  'README.md.tmpl',
  'android/settings.gradle.kts.tmpl',
]);

export async function createProject(
  options: CreateProjectOptions,
): Promise<CreateProjectResult> {
  const projectDirectory = path.resolve(options.targetDirectory);
  const projectName = normalizeProjectName(path.basename(projectDirectory));
  const displayName = normalizeDisplayName(
    options.displayName ?? titleCase(projectName),
  );
  const packageId = validatePackageId(
    options.packageId ?? defaultPackageId(projectName),
  );
  const config = createInitialConfig(displayName, projectName, packageId);

  await assertTargetDoesNotExist(projectDirectory);
  const parentDirectory = path.dirname(projectDirectory);
  await mkdir(parentDirectory, { recursive: true });
  const stagingDirectory = await mkdtemp(
    path.join(parentDirectory, `.${projectName}-`),
  );

  try {
    await renderTemplate(stagingDirectory, {
      displayName,
      projectName,
    });
    await writeGeneratedMetadata(stagingDirectory, config, projectName);
    await rename(stagingDirectory, projectDirectory);
  } catch (error) {
    await rm(stagingDirectory, { force: true, recursive: true });
    throw error;
  }

  const shouldInstall = options.install === true;
  if (shouldInstall) {
    const installer = options.installer ?? installWithBun;
    await installer(projectDirectory);
  }

  return {
    displayName,
    installed: shouldInstall,
    packageId,
    projectDirectory,
    projectName,
  };
}

export function normalizeProjectName(value: string): string {
  const projectName = value.trim().toLowerCase();
  if (
    !/^[a-z0-9][a-z0-9._-]*$/u.test(projectName) ||
    projectName.length > 214
  ) {
    throw new Error(
      'Project directory name must start with a letter or number and contain only lowercase letters, numbers, dots, hyphens, or underscores.',
    );
  }
  return projectName;
}

export function normalizeDisplayName(value: string): string {
  const displayName = value.trim().replace(/\s+/gu, ' ');
  if (displayName.length === 0 || displayName.length > 80) {
    throw new Error('Application name must contain between 1 and 80 characters.');
  }
  return displayName;
}

export function defaultPackageId(projectName: string): string {
  const segment = projectName
    .replace(/[^a-z0-9_]+/gu, '_')
    .replace(/^[^a-z]+/u, '')
    .replace(/_+$/gu, '');
  return `com.example.${segment || 'app'}`;
}

export function validatePackageId(value: string): string {
  const packageId = value.trim();
  parseAppConfig({
    jilatax: {
      android: { package: packageId },
      name: 'Package validation',
    },
  });
  return packageId;
}

async function renderTemplate(
  targetRoot: string,
  values: { readonly displayName: string; readonly projectName: string },
): Promise<void> {
  const templateRoot = fileURLToPath(new URL('../template', import.meta.url));
  await copyTemplateDirectory(templateRoot, targetRoot, '', values);
}

async function copyTemplateDirectory(
  templateRoot: string,
  targetRoot: string,
  relativeDirectory: string,
  values: { readonly displayName: string; readonly projectName: string },
): Promise<void> {
  const sourceDirectory = path.join(templateRoot, relativeDirectory);
  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const relativeSource = path.join(relativeDirectory, entry.name);
    const normalizedSource = relativeSource.split(path.sep).join('/');
    const sourcePath = path.join(templateRoot, relativeSource);
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) {
      throw new Error(`Unsupported template entry: ${normalizedSource}`);
    }
    if (entry.isDirectory()) {
      await copyTemplateDirectory(
        templateRoot,
        targetRoot,
        relativeSource,
        values,
      );
      continue;
    }

    const outputRelative = templateOutputPath(normalizedSource);
    const outputPath = path.join(targetRoot, ...outputRelative.split('/'));
    await mkdir(path.dirname(outputPath), { recursive: true });

    if (normalizedSource.endsWith('gradle-wrapper.jar.base64')) {
      const encoded = (await readFile(sourcePath, 'utf8')).replace(/\s+/gu, '');
      await writeFile(outputPath, Buffer.from(encoded, 'base64'));
      continue;
    }
    if (TEXT_TEMPLATE_FILES.has(normalizedSource)) {
      const rendered = renderTextTemplate(
        await readFile(sourcePath, 'utf8'),
        values,
      );
      await writeFile(outputPath, rendered, 'utf8');
      continue;
    }
    if (normalizedSource.endsWith('.tmpl')) {
      throw new Error(`Unregistered text template: ${normalizedSource}`);
    }
    await copyFile(sourcePath, outputPath);
  }
}

function templateOutputPath(relativeSource: string): string {
  if (relativeSource === 'gitignore') return '.gitignore';
  if (relativeSource.endsWith('gradle-wrapper.jar.base64')) {
    return relativeSource.slice(0, -'.base64'.length);
  }
  return relativeSource.endsWith('.tmpl')
    ? relativeSource.slice(0, -'.tmpl'.length)
    : relativeSource;
}

function renderTextTemplate(
  source: string,
  values: { readonly displayName: string; readonly projectName: string },
): string {
  const replacements = new Map<string, string>([
    ['{{displayNameJson}}', JSON.stringify(values.displayName)],
    ['{{projectName}}', values.projectName],
    ['{{projectNameJson}}', JSON.stringify(values.projectName)],
  ]);
  let rendered = source;
  for (const [token, replacement] of replacements) {
    rendered = rendered.replaceAll(token, replacement);
  }
  const unresolved = rendered.match(/\{\{[A-Za-z][A-Za-z0-9]*\}\}/u);
  if (unresolved !== null) {
    throw new Error(`Unresolved template token: ${unresolved[0]}`);
  }
  return rendered;
}

async function writeGeneratedMetadata(
  projectRoot: string,
  config: NormalizedJilataxConfig,
  projectName: string,
): Promise<void> {
  const packageJson = {
    name: projectName,
    version: config.jilatax.version,
    private: true,
    type: 'module',
    packageManager: 'bun@1.3.4',
    engines: { node: '>=22.18.0' },
    scripts: {
      dev: 'rspeedy dev',
      build: 'rspeedy build',
      typecheck: 'tsc -b',
      'run:android': 'jilatax run:android',
      'create:aab': 'jilatax create:aab',
    },
    dependencies: {
      '@lynx-js/react': LYNX_REACT_VERSION,
      jilatax: JILATAX_VERSION,
    },
    devDependencies: {
      '@jilatax/cli': JILATAX_CLI_VERSION,
      '@lynx-js/qrcode-rsbuild-plugin': LYNX_QRCODE_PLUGIN_VERSION,
      '@lynx-js/react-rsbuild-plugin': REACT_PLUGIN_VERSION,
      '@lynx-js/rspeedy': RSPEEDY_VERSION,
      '@lynx-js/types': LYNX_TYPES_VERSION,
      '@types/node': '^22.20.1',
      '@types/react': '^18.3.20',
      typescript: '~5.9.3',
    },
  };
  await writeFile(
    path.join(projectRoot, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(projectRoot, 'app.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
  await syncAndroidProjectConfig(projectRoot, config);
  if (process.platform !== 'win32') {
    await chmod(path.join(projectRoot, 'android', 'gradlew'), 0o755);
  }
}

function createInitialConfig(
  displayName: string,
  projectName: string,
  packageId: string,
): NormalizedJilataxConfig {
  const slug = projectName
    .replace(/[._-]+/gu, '-')
    .replace(/^-|-$/gu, '');
  const schemeBase = projectName
    .replace(/[^a-z0-9+.-]+/gu, '-')
    .replace(/^[^a-z]+/u, '');
  return parseAppConfig({
    $schema: './node_modules/jilatax/schema/app.schema.json',
    jilatax: {
      android: {
        adaptiveIcon: {
          backgroundColor: '#E8FFF2',
          foregroundImage: './assets/icon.png',
        },
        package: packageId,
        predictiveBackGestureEnabled: false,
        versionCode: 1,
      },
      icon: './assets/icon.png',
      name: displayName,
      orientation: 'portrait',
      scheme: schemeBase || 'jilatax-app',
      slug,
      splash: {
        backgroundColor: '#041A17',
        image: './assets/splash-icon.png',
        imageWidth: 96,
        resizeMode: 'contain',
      },
      userInterfaceStyle: 'automatic',
      version: '1.0.0',
    },
  });
}

async function assertTargetDoesNotExist(target: string): Promise<void> {
  try {
    await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Target directory already exists: ${target}`);
}

function titleCase(value: string): string {
  return value
    .split(/[-_.\s]+/u)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function installWithBun(projectDirectory: string): Promise<void> {
  return new Promise((resolveInstall, rejectInstall) => {
    const child = spawn('bun', ['install'], {
      cwd: projectDirectory,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', rejectInstall);
    child.once('close', (code) => {
      if (code === 0) {
        resolveInstall();
        return;
      }
      rejectInstall(new Error(`bun install failed with exit code ${code ?? 1}.`));
    });
  });
}
