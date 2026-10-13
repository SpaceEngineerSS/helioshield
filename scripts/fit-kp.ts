/**
 * Fits the coefficients of the Kp nowcast model in src/model/kp.ts.
 *
 * Data: OMNI2 hourly (bow-shock time-shifted solar wind + Kp) via CDAWeb HAPI.
 * Model: Kp = a + b * X^p + c * P
 *   X = 3-hour mean of the Newell coupling function / 1e4
 *   P = 3-hour mean of sqrt(n) * v^2 / 1e6   (Newell et al. 2008, viscous term)
 *
 * Training years and test years are kept apart so the reported error is honest.
 *
 *   npx tsx scripts/fit-kp.ts            prints coefficients + metrics as JSON
 */

import { newellCoupling } from '../src/model/coupling';

const HAPI = 'https://cdaweb.gsfc.nasa.gov/hapi/data';
const PARAMS = 'BY_GSM1800,BZ_GSM1800,N1800,V1800,KP1800';
const TRAIN = [2000, 2019] as const;
const TEST = [2020, 2025] as const;

interface Hour {
  t: number;
  by: number;
  bz: number;
  n: number;
  v: number;
  kp: number;
}

async function fetchYears(from: number, to: number): Promise<Hour[]> {
  const url =
    `${HAPI}?id=OMNI2_H0_MRG1HR&parameters=${PARAMS}` +
    `&time.min=${from}-01-01T00:00:00Z&time.max=${to + 1}-01-01T00:00:00Z`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HAPI ${res.status}`);
  const text = await res.text();
  const rows: Hour[] = [];
  for (const line of text.split('\n')) {
    const c = line.split(',');
    if (c.length < 6) continue;
    const [by, bz, n, v, kp] = c.slice(1).map(Number);
    if (Math.abs(by) > 900 || Math.abs(bz) > 900 || n > 900 || v > 9000 || kp > 90) continue;
    rows.push({ t: Date.parse(c[0]), by, bz, n, v, kp: kp / 10 });
  }
  return rows;
}

interface Sample {
  x: number;
  p: number;
  kp: number;
}

/** Group hours into the 3-hour Kp intervals (00, 03, 06 … UT). */
function toIntervals(hours: Hour[]): Sample[] {
  const buckets = new Map<number, Hour[]>();
  for (const h of hours) {
    const key = Math.floor(h.t / 10_800_000);
    const b = buckets.get(key);
    if (b) b.push(h);
    else buckets.set(key, [h]);
  }
  const out: Sample[] = [];
  for (const b of buckets.values()) {
    if (b.length < 2) continue;
    let x = 0;
    let p = 0;
    for (const h of b) {
      x += newellCoupling(h.v, h.by, h.bz) / 1e4;
      p += (Math.sqrt(h.n) * h.v * h.v) / 1e6;
    }
    out.push({ x: x / b.length, p: p / b.length, kp: b[0].kp });
  }
  return out;
}

/** Ordinary least squares for kp = a + b*f1 + c*f2. */
function ols(f1: number[], f2: number[], y: number[]): [number, number, number] {
  const n = y.length;
  let s1 = 0, s2 = 0, sy = 0, s11 = 0, s22 = 0, s12 = 0, s1y = 0, s2y = 0;
  for (let i = 0; i < n; i++) {
    s1 += f1[i]; s2 += f2[i]; sy += y[i];
    s11 += f1[i] * f1[i]; s22 += f2[i] * f2[i]; s12 += f1[i] * f2[i];
    s1y += f1[i] * y[i]; s2y += f2[i] * y[i];
  }
  // Solve the 3x3 normal equations with Cramer's rule.
  const m = [
    [n, s1, s2],
    [s1, s11, s12],
    [s2, s12, s22],
  ];
  const r = [sy, s1y, s2y];
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  const col = (k: number) => m.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

function metrics(samples: Sample[], a: number, b: number, c: number, pw: number) {
  let se = 0, ae = 0, within1 = 0;
  const pred: number[] = [];
  for (const s of samples) {
    const k = Math.min(9, Math.max(0, a + b * Math.pow(s.x, pw) + c * s.p));
    pred.push(k);
    const e = k - s.kp;
    se += e * e;
    ae += Math.abs(e);
    if (Math.abs(e) <= 1) within1++;
  }
  const n = samples.length;
  const my = samples.reduce((q, s) => q + s.kp, 0) / n;
  const mp = pred.reduce((q, v) => q + v, 0) / n;
  let cov = 0, vy = 0, vp = 0;
  samples.forEach((s, i) => {
    cov += (s.kp - my) * (pred[i] - mp);
    vy += (s.kp - my) ** 2;
    vp += (pred[i] - mp) ** 2;
  });
  return {
    n,
    rmse: Math.sqrt(se / n),
    mae: ae / n,
    r: cov / Math.sqrt(vy * vp),
    within1: within1 / n,
  };
}

async function main() {
  const train = toIntervals(await fetchYears(...TRAIN));
  const test = toIntervals(await fetchYears(...TEST));

  let best = { rmse: Infinity, a: 0, b: 0, c: 0, p: 1 };
  for (let pw = 0.2; pw <= 1.0001; pw += 0.05) {
    const [a, b, c] = ols(
      train.map((s) => Math.pow(s.x, pw)),
      train.map((s) => s.p),
      train.map((s) => s.kp),
    );
    const { rmse } = metrics(train, a, b, c, pw);
    if (rmse < best.rmse) best = { rmse, a, b, c, p: pw };
  }

  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  console.log(
    JSON.stringify(
      {
        coefficients: { a: round(best.a), b: round(best.b), c: round(best.c), p: round(best.p) },
        train: { years: TRAIN, ...metrics(train, best.a, best.b, best.c, best.p) },
        test: { years: TEST, ...metrics(test, best.a, best.b, best.c, best.p) },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
