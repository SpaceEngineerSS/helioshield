/**
 * Upstream payload → compact feed shapes.
 *
 * These parsers are deliberately tolerant: SWPC and CCMC change field names
 * and formats from time to time, so a bad row is skipped instead of failing
 * the whole feed. They are pure and run in three places: the Vercel edge
 * function, the browser worker (when the edge feed is unreachable), and the
 * archive script.
 */

import type {
  AlertKind,
  Cme,
  EnlilArrival,
  Flare,
  KpKind,
  KpNowcast,
  KpSeries,
  Num,
  Ovation,
  Scales,
  SolarWind,
  SpaceAlert,
  Xray,
} from './types';
import { classToFlux } from '../model/scales';

type Row = Record<string, unknown>;

export function num(v: unknown): Num {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parse SWPC / DONKI timestamps. They are UTC, often without a zone suffix. */
export function time(v: unknown): number | null {
  if (typeof v !== 'string' || v.length < 10) return null;
  let s = v.trim().replace(' ', 'T');
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += 'Z';
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function rows(payload: unknown): Row[] {
  return Array.isArray(payload) ? (payload.filter((r) => r && typeof r === 'object') as Row[]) : [];
}

const MINUTE = 60_000;

// ─── Solar wind ──────────────────────────────────────────────────────────────

/**
 * Merge RTSW 1-minute plasma and magnetometer products.
 * The feeds interleave several spacecraft; `active: true` marks the one SWPC
 * uses operationally at each minute. Rows are newest-first upstream.
 */
export function solarWind(windPayload: unknown, magPayload: unknown): SolarWind {
  type Acc = { speed: Num; density: Num; temp: Num; bt: Num; by: Num; bz: Num; sc: string | null };
  const byMinute = new Map<number, Acc>();
  const slot = (t: number) => {
    let a = byMinute.get(t);
    if (!a) {
      a = { speed: null, density: null, temp: null, bt: null, by: null, bz: null, sc: null };
      byMinute.set(t, a);
    }
    return a;
  };

  for (const r of rows(windPayload)) {
    if (r.active === false) continue;
    const t = time(r.time_tag);
    if (t == null) continue;
    const a = slot(Math.floor(t / MINUTE) * MINUTE);
    a.speed = num(r.proton_speed);
    a.density = num(r.proton_density);
    a.temp = num(r.proton_temperature);
    a.sc = typeof r.source === 'string' ? r.source : a.sc;
  }
  for (const r of rows(magPayload)) {
    if (r.active === false) continue;
    const t = time(r.time_tag);
    if (t == null) continue;
    const a = slot(Math.floor(t / MINUTE) * MINUTE);
    a.bt = num(r.bt);
    a.by = num(r.by_gsm);
    a.bz = num(r.bz_gsm);
    a.sc = a.sc ?? (typeof r.source === 'string' ? r.source : null);
  }

  const keys = [...byMinute.keys()].sort((x, y) => x - y);
  const out: SolarWind = { t: [], speed: [], density: [], temp: [], bt: [], by: [], bz: [], spacecraft: null };
  for (const k of keys) {
    const a = byMinute.get(k)!;
    // Physically impossible values show up during spacecraft maneuvers.
    const speed = a.speed != null && a.speed > 100 && a.speed < 3500 ? a.speed : null;
    const density = a.density != null && a.density >= 0 && a.density < 500 ? a.density : null;
    out.t.push(k);
    out.speed.push(speed);
    out.density.push(density);
    out.temp.push(a.temp != null && a.temp > 0 ? a.temp : null);
    out.bt.push(a.bt != null && Math.abs(a.bt) < 500 ? a.bt : null);
    out.by.push(a.by != null && Math.abs(a.by) < 500 ? a.by : null);
    out.bz.push(a.bz != null && Math.abs(a.bz) < 500 ? a.bz : null);
  }
  out.spacecraft = keys.length ? byMinute.get(keys[keys.length - 1])!.sc : null;
  return out;
}

// ─── Kp ──────────────────────────────────────────────────────────────────────

/** products/noaa-planetary-k-index-forecast.json */
export function kpSeries(payload: unknown): KpSeries {
  const out: KpSeries = { t: [], kp: [], kind: [] };
  for (const r of rows(payload)) {
    const t = time(r.time_tag);
    const kp = num(r.kp ?? r.Kp);
    if (t == null || kp == null) continue;
    const k = String(r.observed ?? 'observed') as KpKind;
    out.t.push(t);
    out.kp.push(kp);
    out.kind.push(k === 'predicted' || k === 'estimated' ? k : 'observed');
  }
  return out;
}

/**
 * json/planetary_k_index_1m.json
 *
 * For the first minutes of each 3-hour synoptic period the estimate rests on
 * too little magnetometer data (it often reads 0 or close to it). Those rows
 * are dropped, so the last value of the previous period stays on screen.
 */
export function kpNowcast(payload: unknown): KpNowcast {
  const out: KpNowcast = { t: [], kp: [] };
  for (const r of rows(payload)) {
    const t = time(r.time_tag);
    const kp = num(r.estimated_kp ?? r.kp_index);
    if (t == null || kp == null) continue;
    const intoPeriod = t % (3 * 3_600_000);
    if (intoPeriod < 20 * MINUTE) continue;
    out.t.push(t);
    out.kp.push(kp);
  }
  return out;
}

// ─── X-rays and flares ───────────────────────────────────────────────────────

/** json/goes/primary/xrays-1-day.json — keep the long (0.1–0.8 nm) channel. */
export function xray(payload: unknown): Xray {
  const out: Xray = { t: [], flux: [], satellite: null };
  for (const r of rows(payload)) {
    if (r.energy !== '0.1-0.8nm') continue;
    const t = time(r.time_tag);
    if (t == null) continue;
    const f = num(r.flux);
    out.t.push(t);
    out.flux.push(f != null && f > 0 ? f : null);
    out.satellite = num(r.satellite) ?? out.satellite;
  }
  return out;
}

/** json/goes/primary/xray-flares-7-day.json — SWPC's own event list. */
export function flares(payload: unknown): Flare[] {
  const out: Flare[] = [];
  for (const r of rows(payload)) {
    const begin = time(r.begin_time);
    const peak = time(r.max_time) ?? begin;
    const cls = typeof r.max_class === 'string' ? r.max_class : null;
    if (begin == null || peak == null || !cls) continue;
    const flux = num(r.max_xrlong) ?? classToFlux(cls);
    if (flux == null) continue;
    out.push({ begin, peak, end: time(r.end_time), cls, flux });
  }
  return out.sort((a, b) => b.peak - a.peak);
}

/** DONKI FLR (used for the archive, where SWPC lists are not available). */
export function donkiFlares(payload: unknown): Flare[] {
  const out: Flare[] = [];
  for (const r of rows(payload)) {
    const begin = time(r.beginTime);
    const peak = time(r.peakTime) ?? begin;
    const cls = typeof r.classType === 'string' ? r.classType : null;
    if (begin == null || peak == null || !cls) continue;
    const flux = classToFlux(cls);
    if (flux == null) continue;
    out.push({
      begin,
      peak,
      end: time(r.endTime),
      cls,
      flux,
      location: typeof r.sourceLocation === 'string' && r.sourceLocation ? r.sourceLocation : null,
      region: num(r.activeRegionNum),
    });
  }
  return out.sort((a, b) => b.peak - a.peak);
}

// ─── CMEs ────────────────────────────────────────────────────────────────────

function enlilFor(analysis: Row): EnlilArrival | null {
  const list = rows(analysis.enlilList);
  let best: EnlilArrival | null = null;
  let bestRun = -Infinity;
  for (const e of list) {
    const arrival = time(e.estimatedShockArrivalTime);
    if (arrival == null) continue;
    const kps = [num(e.kp_18), num(e.kp_90), num(e.kp_135), num(e.kp_180)].filter((k): k is number => k != null);
    const candidate: EnlilArrival = {
      arrival,
      glancing: e.isEarthGB === true,
      kpLow: kps.length ? Math.min(...kps) : null,
      kpHigh: kps.length ? Math.max(...kps) : null,
    };
    // Keep the most recent run, which reflects the latest analysis.
    const run = time(e.modelCompletionTime) ?? 0;
    if (run >= bestRun) {
      best = candidate;
      bestRun = run;
    }
  }
  return best;
}

/** DONKI CME (CCMC DONKI-API). Uses the analysis marked most accurate. */
export function cmes(payload: unknown): Cme[] {
  const out: Cme[] = [];
  for (const r of rows(payload)) {
    const start = time(r.startTime);
    const id = typeof r.activityID === 'string' ? r.activityID : null;
    if (start == null || !id) continue;
    const analyses = rows(r.cmeAnalyses);
    const a = analyses.find((x) => x.isMostAccurate === true) ?? analyses[analyses.length - 1] ?? null;
    const speed = a ? num(a.speed) : null;
    out.push({
      id,
      start,
      t21: a ? time(a.time21_5) : null,
      speed: speed != null && speed > 0 ? speed : null,
      halfAngle: a ? num(a.halfAngle) : null,
      lat: a ? num(a.latitude) : null,
      lon: a ? num(a.longitude) : null,
      type: a && typeof a.type === 'string' ? a.type : null,
      source: typeof r.sourceLocation === 'string' && r.sourceLocation ? r.sourceLocation : null,
      note: typeof r.note === 'string' ? r.note.slice(0, 600) : '',
      link: typeof r.link === 'string' ? r.link : null,
      enlil: a ? enlilFor(a) : null,
    });
  }
  return out.sort((x, y) => y.start - x.start);
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

function alertKind(code: string): AlertKind {
  if (code.startsWith('ALT')) return 'alert';
  if (code.startsWith('WAR')) return 'warning';
  if (code.startsWith('WAT')) return 'watch';
  if (code.startsWith('SUM')) return 'summary';
  return 'other';
}

/** products/alerts.json — bulletins are plain text; pull out the headline. */
export function alerts(payload: unknown): SpaceAlert[] {
  const out: SpaceAlert[] = [];
  for (const r of rows(payload)) {
    const message = typeof r.message === 'string' ? r.message.replace(/\r/g, '') : '';
    const issued = time(r.issue_datetime);
    if (!message || issued == null) continue;
    const code = /Message Code:\s*(\w+)/.exec(message)?.[1] ?? String(r.product_id ?? '');
    const serial = /Serial Number:\s*(\d+)/.exec(message)?.[1] ?? '';
    const lines = message.split('\n').map((l) => l.trim());
    const headIdx = lines.findIndex((l) => /^(EXTENDED |CANCEL )?(ALERT|WARNING|WATCH|SUMMARY)\b/.test(l));
    const title = headIdx >= 0 ? lines[headIdx] : lines.find((l) => l && !/^(Space Weather|Serial|Issue)/.test(l)) ?? code;
    const body = lines
      .slice(headIdx >= 0 ? headIdx + 1 : 3)
      .filter((l) => !/swpc\.noaa\.gov|^NOAA Space Weather Scale descriptions/.test(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    out.push({ id: `${code}-${serial}-${issued}`, issued, kind: alertKind(code), code, title, body });
  }
  return out.sort((a, b) => b.issued - a.issued);
}

// ─── Aurora ──────────────────────────────────────────────────────────────────

/** json/ovation_aurora_latest.json → dense 360 × 181 grid. */
export function ovation(payload: unknown): Ovation {
  const p = (payload ?? {}) as Row;
  const values = new Array<number>(360 * 181).fill(0);
  const coords = Array.isArray(p.coordinates) ? p.coordinates : [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 3) continue;
    const lon = Math.round(Number(c[0]));
    const lat = Math.round(Number(c[1]));
    const v = Number(c[2]);
    if (!(lon >= 0 && lon < 360 && lat >= -90 && lat <= 90 && v >= 0)) continue;
    values[lon * 181 + lat + 90] = Math.min(100, Math.round(v));
  }
  return {
    observed: time(p['Observation Time']) ?? 0,
    forecast: time(p['Forecast Time']) ?? 0,
    values,
  };
}

// ─── NOAA scales ─────────────────────────────────────────────────────────────

/** products/noaa-scales.json — "0" is now, "1".."3" are the next days. */
export function scales(payload: unknown): Scales {
  const p = (payload ?? {}) as Record<string, Row>;
  const now = p['0'] ?? {};
  const scale = (o: unknown) => num((o as Row | undefined)?.Scale) ?? 0;
  const days = ['1', '2', '3']
    .map((k) => p[k])
    .filter(Boolean)
    .map((d) => ({
      date: String(d.DateStamp ?? ''),
      g: num((d.G as Row | undefined)?.Scale),
      rMinorProb: num((d.R as Row | undefined)?.MinorProb),
      rMajorProb: num((d.R as Row | undefined)?.MajorProb),
      sProb: num((d.S as Row | undefined)?.Prob),
    }));
  return {
    issued: time(`${now.DateStamp ?? ''}T${now.TimeStamp ?? '00:00:00'}`) ?? 0,
    current: { g: scale(now.G), r: scale(now.R), s: scale(now.S) },
    days,
  };
}
