import { newellCoupling } from './coupling';

/**
 * Kp nowcast from upstream solar wind.
 *
 *   Kp = a + b·X^p + c·P
 *   X = ⟨Newell dΦ/dt⟩ / 1e4 over the window
 *   P = ⟨√n · v²⟩ / 1e6 over the window
 *
 * Coefficients come from `scripts/fit-kp.ts`: OMNI2 hourly data, trained on
 * 2000–2019 and tested on 2020–2025. On the test years the model reaches
 * RMSE 0.69, r = 0.85, and 87% of intervals within ±1 Kp. See docs/validation.md.
 */
export const KP_FIT = { a: -0.5375, b: 2.438, c: 3.2186, p: 0.8 } as const;

export function kpFromDrivers(meanCoupling: number, meanViscous: number): number {
  const x = Math.max(0, meanCoupling) / 1e4;
  const k = KP_FIT.a + KP_FIT.b * Math.pow(x, KP_FIT.p) + KP_FIT.c * Math.max(0, meanViscous);
  return Math.min(9, Math.max(0, k));
}

/**
 * Estimate Kp from the solar wind samples in [from, to].
 * Returns null when fewer than a quarter of the samples are usable.
 */
export function estimateKp(
  t: ArrayLike<number>,
  speed: ArrayLike<number | null>,
  density: ArrayLike<number | null>,
  by: ArrayLike<number | null>,
  bz: ArrayLike<number | null>,
  from: number,
  to: number,
  lo = 0,
): { kp: number; coupling: number; samples: number } | null {
  let c = 0;
  let p = 0;
  let n = 0;
  let seen = 0;
  for (let i = lo; i < t.length && t[i] <= to; i++) {
    if (t[i] < from) continue;
    seen++;
    const v = speed[i];
    const y = by[i];
    const z = bz[i];
    if (v == null || y == null || z == null) continue;
    const d = density[i];
    c += newellCoupling(v, y, z);
    p += d != null && d >= 0 ? (Math.sqrt(d) * v * v) / 1e6 : (Math.sqrt(5) * v * v) / 1e6;
    n++;
  }
  if (n === 0 || n < seen / 4) return null;
  return { kp: kpFromDrivers(c / n, p / n), coupling: c / n, samples: n };
}

/**
 * NOAA G-scale from Kp. SWPC counts the whole third-step band, so 5- (4.67)
 * is already G1 and 9- (8.67) is G5.
 */
export function gScale(kp: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const k = kp + 0.34;
  if (k >= 9) return 5;
  if (k >= 8) return 4;
  if (k >= 7) return 3;
  if (k >= 6) return 2;
  if (k >= 5) return 1;
  return 0;
}

/** Kp in thirds, the way it is published: 5-, 5o, 5+. */
export function formatKp(kp: number): string {
  const r = Math.round(kp * 3) / 3;
  const whole = Math.round(r);
  const diff = r - whole;
  if (Math.abs(diff) < 0.1) return `${whole}o`;
  return diff > 0 ? `${whole}+` : `${whole}-`;
}
