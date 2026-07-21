import { createHash } from 'node:crypto';

import { errorMessage } from './errors.js';
import type { CliServices } from './process.js';

const DEFAULT_LIVE_RELOAD_INTERVAL = 500;

export interface LiveReloadHandle {
  readonly stopped: Promise<void>;
  stop(): void;
}

interface StartLiveReloadOptions {
  readonly bundleUrl: string;
  readonly onBundleChange: () => Promise<void>;
  readonly pollInterval?: number;
}

export async function startLiveReload(
  options: StartLiveReloadOptions,
  services: CliServices,
): Promise<LiveReloadHandle> {
  const pollInterval =
    options.pollInterval ?? DEFAULT_LIVE_RELOAD_INTERVAL;
  let currentRevision = await tryReadBundleRevision(
    options.bundleUrl,
    services,
  );
  let activeController: AbortController | undefined;
  let polling = false;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let warnedAboutBundle = false;
  let warnedAboutReload = false;
  let resolveStopped: (() => void) | undefined;
  const stoppedPromise = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });

  const finish = (): void => {
    if (resolveStopped === undefined) return;
    resolveStopped();
    resolveStopped = undefined;
  };

  const schedule = (): void => {
    if (stopped) {
      finish();
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      void poll();
    }, pollInterval);
  };

  const poll = async (): Promise<void> => {
    polling = true;
    const controller = new AbortController();
    activeController = controller;
    try {
      const nextRevision = await readBundleRevision(
        options.bundleUrl,
        services,
        controller,
      );
      warnedAboutBundle = false;
      if (currentRevision === undefined) {
        currentRevision = nextRevision;
      } else if (nextRevision !== currentRevision) {
        services.log('Rspeedy rebuilt the Lynx bundle. Reloading Android...');
        try {
          await options.onBundleChange();
          currentRevision = nextRevision;
          warnedAboutReload = false;
        } catch (error) {
          if (!warnedAboutReload) {
            services.warn(
              `Android live reload failed: ${errorMessage(error)}`,
            );
            warnedAboutReload = true;
          }
        }
      }
    } catch (error) {
      if (!stopped && !warnedAboutBundle) {
        services.warn(
          `Live reload is waiting for ${options.bundleUrl}: ${errorMessage(error)}`,
        );
        warnedAboutBundle = true;
      }
    } finally {
      if (activeController === controller) activeController = undefined;
      polling = false;
      schedule();
    }
  };

  schedule();
  return {
    stopped: stoppedPromise,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      activeController?.abort();
      if (!polling) finish();
    },
  };
}

async function tryReadBundleRevision(
  url: string,
  services: CliServices,
): Promise<string | undefined> {
  const controller = new AbortController();
  try {
    return await readBundleRevision(url, services, controller);
  } catch {
    return undefined;
  }
}

async function readBundleRevision(
  url: string,
  services: CliServices,
  controller: AbortController,
): Promise<string> {
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const metadata = await services.fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    const entityTag = metadata.headers.get('etag');
    if (metadata.ok && entityTag !== null && entityTag.length > 0) {
      return `etag:${entityTag}`;
    }

    const response = await services.fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const bundle = Buffer.from(await response.arrayBuffer());
    if (bundle.byteLength === 0) throw new Error('the bundle is empty');
    return createHash('sha256').update(bundle).digest('hex');
  } finally {
    clearTimeout(timeout);
  }
}
