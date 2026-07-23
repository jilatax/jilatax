import { Redis } from '@upstash/redis';
import { NPM_PACKAGES, NPM_TRACKING_START } from '@/lib/npm-packages';

const CACHE_KEY = 'jilatax:website:npm-stats:v1';
const CACHE_VERSION = 1;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_REFRESH_MS = 6 * 60 * 60 * 1000;
const TOTAL_REFRESH_MS = WEEK_MS;
const MAX_RANGE_DAYS = 500;

interface NpmPointResponse {
  downloads?: number;
}

interface NpmRangeResponse {
  downloads?: Array<{ day: string; downloads: number }>;
}

interface PackageStats {
  weeklyDownloads: number;
  totalDownloads: number;
  weeklyUpdatedAt: string;
  totalUpdatedAt: string;
}

interface CachedStats {
  version: number;
  packages: Record<string, PackageStats>;
}

export interface NpmStatsSnapshot {
  weeklyDownloads: number;
  totalDownloads: number;
  packageCount: number;
  weeklyUpdatedAt: string;
  totalUpdatedAt: string;
}

let memoryCache: CachedStats | null = null;

function getRedis(): Redis | null {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isFresh(value: string | undefined, maxAge: number, now: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now - timestamp < maxAge;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new Error(`npm responded with ${response.status}`);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

async function fetchWeeklyDownloads(packageName: string): Promise<number> {
  const encodedName = encodeURIComponent(packageName);
  const data = await fetchJson<NpmPointResponse>(
    `https://api.npmjs.org/downloads/point/last-week/${encodedName}`,
  );

  if (!Number.isFinite(data.downloads)) {
    throw new Error(`npm returned invalid weekly downloads for ${packageName}`);
  }

  return data.downloads ?? 0;
}

async function fetchTotalDownloads(packageName: string): Promise<number> {
  const encodedName = encodeURIComponent(packageName);
  const finalDate = new Date();
  let chunkStart = new Date(`${NPM_TRACKING_START}T00:00:00.000Z`);
  let total = 0;

  while (chunkStart <= finalDate) {
    const candidateEnd = addDays(chunkStart, MAX_RANGE_DAYS - 1);
    const chunkEnd = candidateEnd < finalDate ? candidateEnd : finalDate;
    const period = `${formatDate(chunkStart)}:${formatDate(chunkEnd)}`;
    const data = await fetchJson<NpmRangeResponse>(
      `https://api.npmjs.org/downloads/range/${period}/${encodedName}`,
    );

    if (!Array.isArray(data.downloads)) {
      throw new Error(`npm returned invalid total downloads for ${packageName}`);
    }

    total += data.downloads.reduce((sum, day) => sum + (day.downloads || 0), 0);
    chunkStart = addDays(chunkEnd, 1);
  }

  return total;
}

async function readCache(redis: Redis | null): Promise<CachedStats | null> {
  if (memoryCache) return memoryCache;
  if (!redis) return null;

  try {
    const cached = await redis.get<CachedStats>(CACHE_KEY);
    if (cached?.version === CACHE_VERSION) {
      memoryCache = cached;
      return cached;
    }
  } catch {
    return null;
  }

  return null;
}

async function writeCache(redis: Redis | null, cache: CachedStats): Promise<void> {
  memoryCache = cache;
  if (!redis) return;

  try {
    await redis.set(CACHE_KEY, cache);
  } catch {
    // The npm result remains usable for this request when Redis is unavailable.
  }
}

function createSnapshot(cache: CachedStats, nowIso: string): NpmStatsSnapshot {
  const currentPackages = NPM_PACKAGES.map((name) => cache.packages[name]).filter(Boolean);
  const weeklyDownloads = currentPackages.reduce((sum, stats) => sum + stats.weeklyDownloads, 0);
  const totalDownloads = currentPackages.reduce((sum, stats) => sum + stats.totalDownloads, 0);
  const weeklyUpdatedAt = currentPackages
    .map((stats) => stats.weeklyUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(0) ?? nowIso;
  const totalUpdatedAt = currentPackages
    .map((stats) => stats.totalUpdatedAt)
    .filter(Boolean)
    .sort()
    .at(0) ?? nowIso;

  return {
    weeklyDownloads,
    totalDownloads,
    packageCount: NPM_PACKAGES.length,
    weeklyUpdatedAt,
    totalUpdatedAt,
  };
}

export async function getNpmStats(): Promise<NpmStatsSnapshot> {
  const redis = getRedis();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const cached = await readCache(redis);
  const packages: Record<string, PackageStats> = {};

  await Promise.all(NPM_PACKAGES.map(async (packageName) => {
    const previous = cached?.packages[packageName];
    const next: PackageStats = previous
      ? { ...previous }
      : {
          weeklyDownloads: 0,
          totalDownloads: 0,
          weeklyUpdatedAt: '',
          totalUpdatedAt: '',
        };

    const jobs: Promise<void>[] = [];

    if (!isFresh(previous?.weeklyUpdatedAt, WEEKLY_REFRESH_MS, now)) {
      jobs.push(fetchWeeklyDownloads(packageName).then((downloads) => {
        next.weeklyDownloads = downloads;
        next.weeklyUpdatedAt = nowIso;
      }));
    }

    if (!isFresh(previous?.totalUpdatedAt, TOTAL_REFRESH_MS, now)) {
      jobs.push(fetchTotalDownloads(packageName).then((downloads) => {
        next.totalDownloads = downloads;
        next.totalUpdatedAt = nowIso;
      }));
    }

    await Promise.allSettled(jobs);
    packages[packageName] = next;
  }));

  const nextCache: CachedStats = {
    version: CACHE_VERSION,
    packages,
  };

  await writeCache(redis, nextCache);
  return createSnapshot(nextCache, nowIso);
}
