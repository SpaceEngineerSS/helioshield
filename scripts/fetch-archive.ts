/**
 * Builds public/archive/<event>.json from the original archives:
 *
 *   OMNI HRO 1-min (CDAWeb HAPI)  solar wind at the bow shock + SYM-H
 *   GFZ Potsdam                    definitive Kp
 *   NASA CCMC DONKI                CMEs, flares, interplanetary shocks (2010+)
 *
 * DONKI starts in 2010, so the 2003 event carries a short hand-written list
 * of flares and CMEs with the references next to each entry.
 *
 *   npx tsx scripts/fetch-archive.ts            all events
 *   npx tsx scripts/fetch-archive.ts gannon-2024
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { ARCHIVE } from '../src/data/archive';
import type { ArchiveEvent } from '../src/data/archive';
import { cmes as parseCmes, donkiFlares, time } from '../src/data/transform';
import type { Cme, Flare, Num, SolarWind } from '../src/data/types';
import { classifyImpact } from '../src/model/cme-geometry';

const HAPI = 'https://cdaweb.gsfc.nasa.gov/hapi/data';
const DONKI = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';
const GFZ = 'https://kp.gfz.de/app/json/';
const DAY = 86_400_000;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + 'Z';
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** OMNI fill values are 9s of various widths. */
function omni(v: string, fill: number): Num {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) < fill * 0.99 ? n : null;
}

async function fetchOmni(from: number, to: number): Promise<{ sw: SolarWind; symh: { t: number[]; v: Num[] } }> {
  const params = 'F,BY_GSM,BZ_GSM,flow_speed,proton_density,T,SYM_H';
  const url = `${HAPI}?id=OMNI_HRO_1MIN&parameters=${params}&time.min=${iso(from)}&time.max=${iso(to)}`;
  const text = await (await fetch(url)).text();
  const sw: SolarWind = { t: [], speed: [], density: [], temp: [], bt: [], by: [], bz: [], spacecraft: 'OMNI' };
  const symh = { t: [] as number[], v: [] as Num[] };
  const r1 = (x: Num) => (x == null ? null : Math.round(x * 10) / 10);
  const r0 = (x: Num) => (x == null ? null : Math.round(x));
  for (const line of text.split('\n')) {
    const c = line.trim().split(',');
    if (c.length < 8) continue;
    const t = Date.parse(c[0]);
    if (!Number.isFinite(t)) continue;
    sw.t.push(t);
    sw.bt.push(r1(omni(c[1], 9999.99)));
    sw.by.push(r1(omni(c[2], 9999.99)));
    sw.bz.push(r1(omni(c[3], 9999.99)));
    sw.speed.push(r0(omni(c[4], 99999.9)));
    sw.density.push(r1(omni(c[5], 999.99)));
    const temp = omni(c[6], 9999999);
    sw.temp.push(temp == null ? null : Math.round(temp / 100) * 100);
    symh.t.push(t);
    symh.v.push(r0(omni(c[7], 99999)));
  }
  return { sw, symh };
}

async function fetchKp(from: number, to: number) {
  const body = (await getJson(`${GFZ}?start=${iso(from)}&end=${iso(to)}&index=Kp`)) as {
    Kp: number[];
    datetime: string[];
  };
  return {
    t: body.datetime.map((d) => Date.parse(d)),
    kp: body.Kp.map((k) => Math.round(k * 1000) / 1000),
    kind: body.Kp.map(() => 'observed' as const),
  };
}

async function fetchShocks(from: number, to: number): Promise<number[]> {
  const list = (await getJson(`${DONKI}/IPS?startDate=${ymd(from)}&endDate=${ymd(to)}&location=Earth`)) as {
    eventTime: string;
  }[];
  return list.map((s) => time(s.eventTime)).filter((t): t is number => t != null && t >= from && t <= to);
}

/** Hand-entered 2003 events. DONKI does not cover this period. */
const HALLOWEEN_2003 = {
  flares: [
    // GOES event list; locations from NOAA SRS (AR 10486).
    { begin: '2003-10-28T09:51Z', peak: '2003-10-28T11:10Z', end: '2003-10-28T11:24Z', cls: 'X17.2', location: 'S16E08', region: 10486 },
    { begin: '2003-10-29T20:37Z', peak: '2003-10-29T20:49Z', end: '2003-10-29T21:01Z', cls: 'X10.0', location: 'S15W02', region: 10486 },
  ],
  cmes: [
    // SOHO/LASCO CDAW catalog linear speeds; both full halos, so the
    // half-angle is a nominal 60° rather than a measurement.
    { id: '2003-10-28T11:30:00-CME-LASCO', start: '2003-10-28T11:30Z', speed: 2459, lat: -16, lon: -8 },
    { id: '2003-10-29T20:54:00-CME-LASCO', start: '2003-10-29T20:54Z', speed: 2029, lat: -15, lon: 2 },
  ],
  // Storm sudden commencements recorded by ground magnetometers.
  shocks: ['2003-10-29T06:11Z', '2003-10-30T16:19Z'],
};

function halloween(): { flares: Flare[]; cmes: Cme[]; shocks: number[] } {
  const flares: Flare[] = HALLOWEEN_2003.flares.map((f) => ({
    begin: time(f.begin)!,
    peak: time(f.peak)!,
    end: time(f.end),
    cls: f.cls,
    flux: f.cls.startsWith('X17') ? 1.72e-3 : 1.0e-3,
    location: f.location,
    region: f.region,
  }));
  const cmes: Cme[] = HALLOWEEN_2003.cmes.map((c) => ({
    id: c.id,
    start: time(c.start)!,
    t21: null,
    speed: c.speed,
    halfAngle: 60,
    lat: c.lat,
    lon: c.lon,
    type: 'ER',
    source: null,
    note: 'Full halo CME. Speed from the SOHO/LASCO CDAW catalog; half-angle nominal.',
    link: 'https://cdaw.gsfc.nasa.gov/CME_list/',
    enlil: null,
  }));
  return { flares, cmes, shocks: HALLOWEEN_2003.shocks.map((s) => time(s)!) };
}

function argExtreme(t: number[], v: Num[], pick: 'min' | 'max'): number | null {
  let best: number | null = null;
  let at: number | null = null;
  v.forEach((x, i) => {
    if (x == null) return;
    if (best == null || (pick === 'min' ? x < best : x > best)) {
      best = x;
      at = t[i];
    }
  });
  return at;
}

async function build(entry: (typeof ARCHIVE)[number]): Promise<ArchiveEvent> {
  const from = Date.parse(entry.start);
  const to = Date.parse(entry.end);
  const legacy = from < Date.UTC(2010, 0, 1);

  const [{ sw, symh }, kp] = await Promise.all([fetchOmni(from, to), fetchKp(from, to)]);

  let flares: Flare[];
  let cmes: Cme[];
  let shocks: number[];
  if (legacy) {
    ({ flares, cmes, shocks } = halloween());
  } else {
    const [rawCme, rawFlr, ips] = await Promise.all([
      getJson(`${DONKI}/CME?startDate=${ymd(from - 4 * DAY)}&endDate=${ymd(to)}`),
      getJson(`${DONKI}/FLR?startDate=${ymd(from - 3 * DAY)}&endDate=${ymd(to)}`),
      fetchShocks(from, to),
    ]);
    cmes = parseCmes(rawCme).filter((c) => {
      if (c.start > to || c.speed == null || c.speed < 450) return false;
      const { impact } = classifyImpact(c.lat, c.lon, c.halfAngle, c.start);
      return impact === 'direct' || impact === 'flank' || c.enlil != null;
    });
    flares = donkiFlares(rawFlr).filter((f) => f.flux >= 1e-5 && f.peak <= to);
    shocks = ips;
  }

  const marks: ArchiveEvent['marks'] = shocks.map((t) => ({ t, key: 'shock' }));
  const kpPeak = argExtreme(kp.t, kp.kp, 'max');
  if (kpPeak != null) marks.push({ t: kpPeak + 90 * 60_000, key: 'peakKp' });
  const symhMin = argExtreme(symh.t, symh.v, 'min');
  if (symhMin != null) marks.push({ t: symhMin, key: 'minSymh' });
  marks.sort((a, b) => a.t - b.t);

  return {
    id: entry.id,
    range: [from, to],
    sw,
    kp,
    symh,
    flares,
    cmes,
    marks,
    sources: [
      'OMNI HRO 1-min, NASA GSFC SPDF (King & Papitashvili 2005)',
      'Kp: GFZ Potsdam (Matzka et al. 2021), CC BY 4.0',
      legacy ? 'Flares: NOAA GOES event list · CMEs: SOHO/LASCO CDAW catalog' : 'CMEs, flares, shocks: NASA CCMC DONKI',
    ],
  };
}

async function main() {
  const only = process.argv[2];
  await mkdir('public/archive', { recursive: true });
  for (const entry of ARCHIVE) {
    if (only && entry.id !== only) continue;
    process.stdout.write(`${entry.id} … `);
    const event = await build(entry);
    const json = JSON.stringify(event);
    await writeFile(`public/archive/${entry.id}.json`, json);
    console.log(`${(json.length / 1024).toFixed(0)} KB, ${event.cmes.length} CMEs, ${event.flares.length} flares`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
