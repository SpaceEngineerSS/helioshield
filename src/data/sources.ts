/**
 * Every upstream the app reads, in one place. The edge function and the
 * browser fallback both build feeds from this table, so they cannot drift.
 */

import type { FeedId, FeedMap } from './types';
import * as tx from './transform';

const SWPC = 'https://services.swpc.noaa.gov';
const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export interface FeedSource<K extends FeedId> {
  id: K;
  /** Upstream URLs; the builder receives their parsed JSON in the same order. */
  urls: (now: number) => string[];
  build: (...payloads: unknown[]) => FeedMap[K];
  /** Seconds a response stays fresh at the edge and in the client poller. */
  ttl: number;
  /** Human-readable credit shown in the UI. */
  credit: string;
}

type Registry = { [K in FeedId]: FeedSource<K> };

export const SOURCES: Registry = {
  solarwind: {
    id: 'solarwind',
    urls: () => [`${SWPC}/json/rtsw/rtsw_wind_1m.json`, `${SWPC}/json/rtsw/rtsw_mag_1m.json`],
    build: (wind, mag) => tx.solarWind(wind, mag),
    ttl: 60,
    credit: 'NOAA SWPC Real-Time Solar Wind',
  },
  kp: {
    id: 'kp',
    urls: () => [`${SWPC}/products/noaa-planetary-k-index-forecast.json`],
    build: (p) => tx.kpSeries(p),
    ttl: 600,
    credit: 'NOAA SWPC planetary K-index',
  },
  kpnow: {
    id: 'kpnow',
    urls: () => [`${SWPC}/json/planetary_k_index_1m.json`],
    build: (p) => tx.kpNowcast(p),
    ttl: 60,
    credit: 'NOAA SWPC estimated Kp',
  },
  xray: {
    id: 'xray',
    urls: () => [`${SWPC}/json/goes/primary/xrays-1-day.json`],
    build: (p) => tx.xray(p),
    ttl: 60,
    credit: 'NOAA GOES X-ray flux',
  },
  flares: {
    id: 'flares',
    urls: () => [`${SWPC}/json/goes/primary/xray-flares-7-day.json`],
    build: (p) => tx.flares(p),
    ttl: 300,
    credit: 'NOAA GOES flare list',
  },
  cme: {
    id: 'cme',
    urls: (now) => [`${DONKI}/CME?startDate=${ymd(now - 21 * 86_400_000)}&endDate=${ymd(now + 86_400_000)}`],
    build: (p) => tx.cmes(p),
    ttl: 900,
    credit: 'NASA CCMC DONKI',
  },
  alerts: {
    id: 'alerts',
    urls: () => [`${SWPC}/products/alerts.json`],
    build: (p) => tx.alerts(p),
    ttl: 120,
    credit: 'NOAA SWPC alerts',
  },
  ovation: {
    id: 'ovation',
    urls: () => [`${SWPC}/json/ovation_aurora_latest.json`],
    build: (p) => tx.ovation(p),
    ttl: 300,
    credit: 'NOAA SWPC OVATION aurora model',
  },
  scales: {
    id: 'scales',
    urls: () => [`${SWPC}/products/noaa-scales.json`],
    build: (p) => tx.scales(p),
    ttl: 300,
    credit: 'NOAA space weather scales',
  },
};

export const FEED_IDS = Object.keys(SOURCES) as FeedId[];

export function isFeedId(v: string | null): v is FeedId {
  return v != null && Object.prototype.hasOwnProperty.call(SOURCES, v);
}

/** Fetch every upstream for a feed and build it. Throws on any upstream failure. */
export async function buildFeed<K extends FeedId>(
  id: K,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<FeedMap[K]> {
  const src = SOURCES[id] as FeedSource<K>;
  const payloads = await Promise.all(
    src.urls(Date.now()).map(async (url) => {
      const res = await fetcher(url, { signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`${id}: upstream ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) throw new Error(`${id}: upstream returned HTML`);
      return res.json();
    }),
  );
  return src.build(...payloads);
}
