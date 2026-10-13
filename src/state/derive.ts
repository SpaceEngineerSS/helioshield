/**
 * Turns raw feeds (live) or an archive event (replay) into one Dataset shape,
 * and reads a Snapshot of everything at the cursor. Panels only ever see these
 * two, so live and replay share every component.
 */

import { createContext, useContext, useMemo } from 'react';
import { useStore } from './store';
import type { Cme, Flare, KpNowcast, KpSeries, Num, SolarWind, Xray } from '../data/types';
import type { ArchiveEvent } from '../data/archive';
import { estimateKp, gScale } from '../model/kp';
import { C2_FIRST_SEEN_R0, DBM_DEFAULTS, estimateArrival, frontPositionAu, type ArrivalEstimate } from '../model/dbm';
import { classifyImpact, type EarthImpact } from '../model/cme-geometry';
import { indexAt, lastValid } from '../model/series';
import { rScale } from '../model/scales';
import { dynamicPressure } from '../model/coupling';
import { shue1998, type Magnetopause } from '../model/magnetopause';
import { HOUR_MS, L1_DISTANCE_KM, MINUTE_MS } from '../model/constants';

export interface CmeTrack extends Cme {
  impact: EarthImpact;
  separation: number | null;
  launch: number;
  r0: number;
  dbm: ArrivalEstimate | null;
  /** Ambient wind used for the DBM run, km/s. */
  ambient: number;
}

export interface Dataset {
  kind: 'live' | 'replay';
  range: [number, number];
  sw: SolarWind | null;
  kp: KpSeries | null;
  kpnow: KpNowcast | null;
  xray: Xray | null;
  flares: Flare[];
  cmes: CmeTrack[];
  symh: { t: number[]; v: Num[] } | null;
  marks: { t: number; key: string }[];
  /** Our Kp nowcast, one value every 10 minutes, placed at the time it applies to Earth. */
  modelKp: { t: number[]; kp: Num[] };
  /** Live data reaches Earth ~1 h after L1; OMNI archive data is already shifted. */
  shifted: boolean;
}

const MODEL_STEP = 10 * MINUTE_MS;

function buildModelKp(sw: SolarWind | null, shifted: boolean): Dataset['modelKp'] {
  const out = { t: [] as number[], kp: [] as Num[] };
  if (!sw || sw.t.length === 0) return out;
  const first = sw.t[0];
  const last = sw.t[sw.t.length - 1];
  let lo = 0;
  for (let end = first + 3 * HOUR_MS; end <= last + 1; end += MODEL_STEP) {
    while (lo < sw.t.length && sw.t[lo] < end - 3 * HOUR_MS) lo++;
    const r = estimateKp(sw.t, sw.speed, sw.density, sw.by, sw.bz, end - 3 * HOUR_MS, end, lo);
    let lead = 0;
    if (!shifted) {
      const v = lastValid(sw.speed, indexAt(sw.t, end), 60)?.value ?? 450;
      lead = (L1_DISTANCE_KM / v) * 1000;
    }
    out.t.push(Math.round((end + lead) / MINUTE_MS) * MINUTE_MS);
    out.kp.push(r ? Math.round(r.kp * 100) / 100 : null);
  }
  return out;
}

function medianSpeed(sw: SolarWind | null, before: number): number {
  if (!sw) return DBM_DEFAULTS.w;
  const end = indexAt(sw.t, before);
  const vals: number[] = [];
  for (let i = end; i >= 0 && sw.t[i] > before - 6 * HOUR_MS; i--) {
    const v = sw.speed[i];
    if (v != null) vals.push(v);
  }
  if (vals.length < 30) return DBM_DEFAULTS.w;
  vals.sort((a, b) => a - b);
  return Math.min(700, Math.max(300, vals[vals.length >> 1]));
}

/**
 * Worth tracking toward Earth: the cone includes Earth, or CCMC's ENLIL run
 * predicts an Earth arrival even though DONKI has no cone direction.
 */
export function isEarthBound(c: { impact: EarthImpact; enlil: Cme['enlil'] }): boolean {
  return c.impact === 'direct' || c.impact === 'flank' || (c.impact === 'unknown' && c.enlil != null);
}

function trackCmes(cmes: Cme[], sw: SolarWind | null): CmeTrack[] {
  return cmes.map((c) => {
    const { impact, separation } = classifyImpact(c.lat, c.lon, c.halfAngle, c.start);
    const launch = c.t21 ?? c.start;
    const r0 = c.t21 != null ? DBM_DEFAULTS.r0 : C2_FIRST_SEEN_R0;
    const ambient = medianSpeed(sw, launch);
    const dbm = c.speed != null && isEarthBound({ impact, enlil: c.enlil }) ? estimateArrival(launch, c.speed, ambient, r0) : null;
    return { ...c, impact, separation, launch, r0, dbm, ambient };
  });
}

function fromLive(feeds: ReturnType<typeof useStore.getState>['feeds']): Dataset {
  const sw = feeds.solarwind.data;
  const xray = feeds.xray.data;
  const lastT = Math.max(sw?.t.at(-1) ?? 0, xray?.t.at(-1) ?? 0) || Date.now();
  return {
    kind: 'live',
    range: [lastT - 24 * HOUR_MS, lastT],
    sw,
    kp: feeds.kp.data,
    kpnow: feeds.kpnow.data,
    xray,
    flares: feeds.flares.data ?? [],
    cmes: trackCmes(feeds.cme.data ?? [], sw),
    symh: null,
    marks: [],
    modelKp: buildModelKp(sw, false),
    shifted: false,
  };
}

function fromArchive(e: ArchiveEvent): Dataset {
  return {
    kind: 'replay',
    range: e.range,
    sw: e.sw,
    kp: e.kp,
    kpnow: null,
    xray: null,
    flares: e.flares,
    cmes: trackCmes(e.cmes, e.sw),
    symh: e.symh,
    marks: e.marks,
    modelKp: buildModelKp(e.sw, true),
    shifted: true,
  };
}

/** Build the dataset once, at the root. Panels read it through `useDataset()`. */
export function useBuildDataset(): Dataset {
  const replay = useStore((s) => s.replay);
  const sw = useStore((s) => s.feeds.solarwind.data);
  const kp = useStore((s) => s.feeds.kp.data);
  const kpnow = useStore((s) => s.feeds.kpnow.data);
  const xray = useStore((s) => s.feeds.xray.data);
  const flares = useStore((s) => s.feeds.flares.data);
  const cme = useStore((s) => s.feeds.cme.data);
  return useMemo(
    () => (replay ? fromArchive(replay) : fromLive(useStore.getState().feeds)),
    // The feed references are the real inputs; getState() just avoids a stale object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replay, sw, kp, kpnow, xray, flares, cme],
  );
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

export interface Snapshot {
  t: number;
  speed: number | null;
  density: number | null;
  temp: number | null;
  bt: number | null;
  by: number | null;
  bz: number | null;
  /** Age of the newest plasma/field sample relative to t, ms. */
  swAge: number | null;
  pressure: number | null;
  magnetopause: Magnetopause | null;
  kpOfficial: number | null;
  kpOfficialKind: 'nowcast' | 'observed' | 'estimated' | 'predicted' | null;
  kpModel: number | null;
  g: number;
  xrayFlux: number | null;
  r: number;
  symh: number | null;
  flaresLast24h: Flare[];
  cmesInFlight: { track: CmeTrack; au: number }[];
}

function kpAt(kp: KpSeries | null, t: number): { kp: number; kind: Snapshot['kpOfficialKind'] } | null {
  if (!kp) return null;
  const i = indexAt(kp.t, t);
  if (i < 0 || t - kp.t[i] > 3 * HOUR_MS) return null;
  return { kp: kp.kp[i], kind: kp.kind[i] };
}

export function snapshotAt(d: Dataset, t: number): Snapshot {
  const sw = d.sw;
  const i = sw ? indexAt(sw.t, t) : -1;
  const pick = (arr: Num[] | undefined) => (sw && arr && i >= 0 ? lastValid(arr, i, 15) : null);
  const speed = pick(sw?.speed);
  const density = pick(sw?.density);
  const bz = pick(sw?.bz);
  const swAge = sw && speed ? t - sw.t[speed.index] : null;

  const pressure = speed && density ? dynamicPressure(density.value, speed.value) : null;
  const magnetopause = bz ? shue1998(bz.value, pressure ?? 2) : null;

  let kpOfficial: number | null = null;
  let kpOfficialKind: Snapshot['kpOfficialKind'] = null;
  if (d.kpnow && d.kpnow.t.length) {
    const k = indexAt(d.kpnow.t, t);
    if (k >= 0 && t - d.kpnow.t[k] < 30 * MINUTE_MS) {
      kpOfficial = d.kpnow.kp[k];
      kpOfficialKind = 'nowcast';
    }
  }
  if (kpOfficial == null) {
    const k = kpAt(d.kp, t);
    if (k) {
      kpOfficial = k.kp;
      kpOfficialKind = k.kind;
    }
  }

  const mi = indexAt(d.modelKp.t, t);
  const kpModel = mi >= 0 && t - d.modelKp.t[mi] < 30 * MINUTE_MS ? d.modelKp.kp[mi] : null;

  let xrayFlux: number | null = null;
  if (d.xray) {
    const xi = indexAt(d.xray.t, t);
    xrayFlux = xi >= 0 ? (lastValid(d.xray.flux, xi, 10)?.value ?? null) : null;
  }

  let symh: number | null = null;
  if (d.symh) {
    const si = indexAt(d.symh.t, t);
    symh = si >= 0 ? (lastValid(d.symh.v, si, 10)?.value ?? null) : null;
  }

  const flaresLast24h = d.flares.filter((f) => f.peak <= t && f.peak > t - 24 * HOUR_MS);
  // Without a live X-ray stream (replay), the radio scale follows the flare list.
  const activeFlare = d.flares.find((f) => f.begin <= t && (f.end ?? f.peak + HOUR_MS) >= t);
  const r = rScale(xrayFlux ?? activeFlare?.flux ?? 0);

  const cmesInFlight: Snapshot['cmesInFlight'] = [];
  for (const track of d.cmes) {
    if (!isEarthBound(track) || track.speed == null || track.launch > t) continue;
    const au = frontPositionAu(track.launch, track.speed, t, track.ambient, track.r0);
    if (au != null && au < 1.1) cmesInFlight.push({ track, au });
  }

  return {
    t,
    speed: speed?.value ?? null,
    density: density?.value ?? null,
    temp: pick(sw?.temp)?.value ?? null,
    bt: pick(sw?.bt)?.value ?? null,
    by: pick(sw?.by)?.value ?? null,
    bz: bz?.value ?? null,
    swAge,
    pressure,
    magnetopause,
    kpOfficial,
    kpOfficialKind,
    kpModel,
    g: gScale(kpOfficial ?? kpModel ?? 0),
    xrayFlux,
    r,
    symh,
    flaresLast24h,
    cmesInFlight,
  };
}

/** The time the dashboard is showing: the cursor, or the newest data when following live. */
export function useViewTime(d: Dataset): number {
  const cursor = useStore((s) => s.cursor);
  return cursor ?? d.range[1];
}

export function useBuildSnapshot(d: Dataset): Snapshot {
  const t = useViewTime(d);
  return useMemo(() => snapshotAt(d, t), [d, t]);
}

export const DatasetContext = createContext<Dataset | null>(null);
export const SnapshotContext = createContext<Snapshot | null>(null);

export function useDataset(): Dataset {
  const d = useContext(DatasetContext);
  if (!d) throw new Error('useDataset outside DatasetContext');
  return d;
}

export function useSnapshot(): Snapshot {
  const s = useContext(SnapshotContext);
  if (!s) throw new Error('useSnapshot outside SnapshotContext');
  return s;
}
