/**
 * Figures for docs/validation.md, drawn straight from the archived data so
 * they can be regenerated whenever the models change.
 *
 *   npx tsx scripts/figures.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { estimateKp } from '../src/model/kp';
import { C2_FIRST_SEEN_R0, DBM_DEFAULTS, estimateArrival } from '../src/model/dbm';
import type { ArchiveEvent } from '../src/data/archive';

const C = {
  bg: '#0e0d0b',
  panel: '#14130f',
  text: '#ede6d8',
  text2: '#b8ae9c',
  text3: '#8d8473',
  rule: 'rgba(237,230,216,0.14)',
  sun: '#e8a33d',
  model: '#a99bd0',
  lv: ['#8fa98a', '#c9b458', '#e8a33d', '#df7a35', '#e2694c', '#e45b70'],
};
const MONO = `font-family="IBM Plex Mono, ui-monospace, Menlo, monospace"`;
const SANS = `font-family="IBM Plex Sans, system-ui, sans-serif"`;

const load = (id: string): ArchiveEvent => JSON.parse(readFileSync(`public/archive/${id}.json`, 'utf8'));
const lvl = (k: number) => C.lv[k >= 8.67 ? 5 : k >= 7.67 ? 4 : k >= 6.67 ? 3 : k >= 5.67 ? 2 : k >= 4.67 ? 1 : 0];

function frame(w: number, h: number, title: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  <rect x="16.5" y="16.5" width="${w - 33}" height="${h - 33}" fill="${C.panel}" stroke="${C.rule}"/>
  <path d="M16.5 26V16.5H26M${w - 16.5} ${h - 26}V${h - 16.5}H${w - 26}" fill="none" stroke="rgba(237,230,216,.4)"/>
  <text x="36" y="48" ${SANS} font-size="13" font-weight="600" letter-spacing="1.2" fill="${C.text}">${title}</text>
  ${body}
</svg>`;
}

/** Observed Kp bars with the model drawn over them, for one storm. */
function kpFigure(id: string, label: string): string {
  const e = load(id);
  const W = 960;
  const H = 360;
  const x0 = 70;
  const x1 = W - 40;
  const y0 = 300;
  const y1 = 80;
  const [t0, t1] = e.range;
  const x = (t: number) => x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);
  const y = (k: number) => y0 - (k / 9) * (y0 - y1);

  let body = '';
  for (let k = 0; k <= 9; k += 3) {
    body += `<line x1="${x0}" x2="${x1}" y1="${y(k)}" y2="${y(k)}" stroke="${C.rule}"/>`;
    body += `<text x="${x0 - 12}" y="${y(k) + 4}" ${MONO} font-size="11" fill="${C.text3}" text-anchor="end">${k}</text>`;
  }
  e.kp.t.forEach((t, i) => {
    if (t < t0 || t >= t1) return;
    const k = e.kp.kp[i];
    const w = x(t + 3 * 3.6e6) - x(t) - 3;
    body += `<rect x="${x(t).toFixed(1)}" y="${y(k).toFixed(1)}" width="${w.toFixed(1)}" height="${(y0 - y(k)).toFixed(1)}" fill="${lvl(k)}" opacity="0.85"/>`;
  });
  const pts: string[] = [];
  for (let t = t0 + 3 * 3.6e6; t <= t1; t += 20 * 60_000) {
    const r = estimateKp(e.sw.t, e.sw.speed, e.sw.density, e.sw.by, e.sw.bz, t - 3 * 3.6e6, t);
    if (r) pts.push(`${x(t - 1.5 * 3.6e6).toFixed(1)},${y(r.kp).toFixed(1)}`);
  }
  body += `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.model}" stroke-width="2"/>`;
  for (let t = Math.ceil(t0 / 86_400_000) * 86_400_000; t < t1; t += 12 * 3.6e6) {
    const d = new Date(t);
    const lab = d.getUTCHours() === 0 ? d.toISOString().slice(5, 10) : '12:00';
    body += `<line x1="${x(t)}" x2="${x(t)}" y1="${y0}" y2="${y0 + 6}" stroke="${C.text3}"/>`;
    body += `<text x="${x(t)}" y="${y0 + 22}" ${MONO} font-size="11" fill="${C.text3}" text-anchor="middle">${lab}</text>`;
  }
  body += `<line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="${C.text3}"/>`;
  body += `<rect x="${W - 360}" y="34" width="12" height="12" fill="${C.lv[4]}" opacity=".85"/><text x="${W - 342}" y="45" ${SANS} font-size="12" fill="${C.text2}">definitive Kp (GFZ)</text>`;
  body += `<line x1="${W - 186}" x2="${W - 166}" y1="40" y2="40" stroke="${C.model}" stroke-width="2"/><text x="${W - 158}" y="45" ${SANS} font-size="12" fill="${C.text2}">HelioShield model</text>`;
  return frame(W, H, label, body);
}

/** Arrival-time error per CME: DBM window and central value, ENLIL where available. */
function dbmFigure(): string {
  const pairs: [string, string, string, string][] = [
    ['october-2024', '2024-10-09T02:12Z', '2024-10-10T14:46Z', 'Oct 2024'],
    ['september-2017', '2017-09-04T20:36Z', '2017-09-06T23:08Z', 'Sep 2017 (1)'],
    ['september-2017', '2017-09-06T12:24Z', '2017-09-07T22:30Z', 'Sep 2017 (2)'],
    ['st-patricks-2015', '2015-03-15T02:00Z', '2015-03-17T04:05Z', 'Mar 2015'],
    ['halloween-2003', '2003-10-28T11:30Z', '2003-10-29T06:11Z', 'Oct 2003 (1)'],
    ['halloween-2003', '2003-10-29T20:54Z', '2003-10-30T16:19Z', 'Oct 2003 (2)'],
    ['gannon-2024', '2024-05-08T05:36Z', '2024-05-10T16:36Z', 'May 2024'],
  ];
  const W = 960;
  const rowH = 38;
  const H = 120 + pairs.length * rowH;
  const x0 = 200;
  const x1 = W - 60;
  const lim = 24;
  const x = (h: number) => x0 + ((h + lim) / (2 * lim)) * (x1 - x0);
  let body = '';
  for (let h = -24; h <= 24; h += 6) {
    body += `<line x1="${x(h)}" x2="${x(h)}" y1="74" y2="${H - 50}" stroke="${h === 0 ? 'rgba(237,230,216,.45)' : C.rule}"/>`;
    body += `<text x="${x(h)}" y="${H - 30}" ${MONO} font-size="11" fill="${C.text3}" text-anchor="middle">${h > 0 ? '+' : ''}${h} h</text>`;
  }
  pairs.forEach(([id, start, obs, label], i) => {
    const e = load(id);
    const c = e.cmes.find((m) => Math.abs(m.start - Date.parse(start)) < 60_000)!;
    const est = estimateArrival(c.t21 ?? c.start, c.speed!, DBM_DEFAULTS.w, c.t21 != null ? DBM_DEFAULTS.r0 : C2_FIRST_SEEN_R0)!;
    const o = Date.parse(obs);
    const h = (t: number) => Math.max(-lim, Math.min(lim, (t - o) / 3.6e6));
    const yy = 92 + i * rowH;
    body += `<text x="36" y="${yy + 4}" ${SANS} font-size="12" fill="${C.text2}">${label}</text>`;
    body += `<text x="${x0 - 14}" y="${yy + 4}" ${MONO} font-size="11" fill="${C.text3}" text-anchor="end">${c.speed} km/s</text>`;
    body += `<line x1="${x(h(est.earliest))}" x2="${x(h(est.latest))}" y1="${yy}" y2="${yy}" stroke="${C.model}" stroke-width="6" stroke-opacity=".35" stroke-linecap="round"/>`;
    body += `<circle cx="${x(h(est.arrival))}" cy="${yy}" r="5" fill="${C.model}"/>`;
    if (c.enlil) body += `<rect x="${x(h(c.enlil.arrival)) - 4.5}" y="${yy - 4.5}" width="9" height="9" fill="none" stroke="${C.sun}" stroke-width="1.6" transform="rotate(45 ${x(h(c.enlil.arrival))} ${yy})"/>`;
  });
  body += `<circle cx="${W - 400}" cy="40" r="5" fill="${C.model}"/><text x="${W - 388}" y="44" ${SANS} font-size="12" fill="${C.text2}">DBM (bar = ensemble window)</text>`;
  body += `<rect x="${W - 150}" y="35.5" width="9" height="9" fill="none" stroke="${C.sun}" stroke-width="1.6" transform="rotate(45 ${W - 145.5} 40)"/><text x="${W - 132}" y="44" ${SANS} font-size="12" fill="${C.text2}">CCMC ENLIL</text>`;
  return frame(W, H, 'CME ARRIVAL ERROR · MODEL MINUS OBSERVED SHOCK', body);
}

writeFileSync('docs/assets/kp-gannon.svg', kpFigure('gannon-2024', 'KP DURING THE GANNON STORM · 10–12 MAY 2024'));
writeFileSync('docs/assets/kp-stpatricks.svg', kpFigure('st-patricks-2015', "KP DURING THE ST. PATRICK'S DAY STORM · 16–19 MARCH 2015"));
writeFileSync('docs/assets/dbm-errors.svg', dbmFigure());
console.log('figures written');
