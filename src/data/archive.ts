/**
 * Historical storms, replayed from real archived measurements.
 * The JSON files in public/archive are produced by scripts/fetch-archive.ts.
 */

import type { Cme, Flare, KpSeries, Num, SolarWind } from './types';

export interface ArchiveEvent {
  id: string;
  range: [number, number];
  /** OMNI 1-minute data, already time-shifted to the bow shock. */
  sw: SolarWind;
  /** Definitive Kp from GFZ Potsdam. */
  kp: KpSeries;
  /** SYM-H, the 1-minute ring-current index (≈ high-resolution Dst), nT. */
  symh: { t: number[]; v: Num[] };
  flares: Flare[];
  cmes: Cme[];
  /** Notable moments marked on the timeline. */
  marks: { t: number; key: string }[];
  /** Where the numbers came from, shown under the replay. */
  sources: string[];
}

export interface ArchiveEntry {
  id: string;
  /** Key into the i18n `events` table for title and story. */
  key: string;
  start: string;
  end: string;
  peakG: number;
}

/** Keep in sync with EVENTS in scripts/fetch-archive.ts. */
export const ARCHIVE: ArchiveEntry[] = [
  { id: 'gannon-2024', key: 'gannon', start: '2024-05-10T00:00Z', end: '2024-05-12T12:00Z', peakG: 5 },
  { id: 'october-2024', key: 'october2024', start: '2024-10-09T12:00Z', end: '2024-10-12T00:00Z', peakG: 4 },
  { id: 'september-2017', key: 'september2017', start: '2017-09-06T06:00Z', end: '2017-09-09T06:00Z', peakG: 4 },
  { id: 'st-patricks-2015', key: 'stpatricks', start: '2015-03-16T12:00Z', end: '2015-03-19T00:00Z', peakG: 4 },
  { id: 'halloween-2003', key: 'halloween', start: '2003-10-28T06:00Z', end: '2003-10-31T06:00Z', peakG: 5 },
];

export async function loadArchive(id: string, signal?: AbortSignal): Promise<ArchiveEvent> {
  const res = await fetch(`${import.meta.env.BASE_URL}archive/${id}.json`, { signal });
  if (!res.ok) throw new Error(`archive ${id}: ${res.status}`);
  return res.json();
}
