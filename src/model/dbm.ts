import { AU_KM, SOLAR_RADIUS_KM } from './constants';

/**
 * Drag-based model of CME propagation (Vršnak et al. 2013, Sol. Phys. 285, 295).
 *
 *   dv/dt = −γ (v − w) |v − w|
 *
 * The equation has a closed-form solution, so we use it directly instead of
 * stepping an integrator:
 *
 *   v(t) = (v₀ − w) / (1 + γ|v₀ − w| t) + w
 *   r(t) = sgn(v₀ − w) / γ · ln(1 + γ|v₀ − w| t) + w t + r₀
 *
 * γ in km⁻¹, speeds in km/s, t in s, r in km.
 */
export interface DbmParams {
  v0: number;
  w: number;
  gamma: number;
  r0: number;
}

/**
 * γ = 0.1×10⁻⁷ km⁻¹ and w = 450 km/s gave the smallest error (MAE ≈ 7 h) on the
 * seven archived CME → shock pairs in docs/validation.md, inside the
 * 0.05–0.2×10⁻⁷ range Vršnak et al. report for fast CMEs.
 */
export const DBM_DEFAULTS = {
  gamma: 0.1e-7,
  w: 450,
  r0: 21.5 * SOLAR_RADIUS_KM,
} as const;

/** Radius for a CME timed at first coronagraph appearance instead of at 21.5 R☉. */
export const C2_FIRST_SEEN_R0 = 2.5 * SOLAR_RADIUS_KM;

export function dbmState({ v0, w, gamma, r0 }: DbmParams, t: number): { r: number; v: number } {
  const dv = v0 - w;
  const k = gamma * Math.abs(dv);
  const denom = 1 + k * t;
  const v = dv / denom + w;
  const r = dv === 0 ? r0 + w * t : (Math.sign(dv) / gamma) * Math.log(denom) + w * t + r0;
  return { r, v };
}

/** Seconds until the front reaches `target` km. r(t) is monotonic, so bisection is safe. */
export function dbmTransitTime(params: DbmParams, target = AU_KM): number | null {
  if (params.r0 >= target) return 0;
  let hi = 3600;
  while (dbmState(params, hi).r < target) {
    hi *= 2;
    if (hi > 30 * 86_400) return null;
  }
  let lo = 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (dbmState(params, mid).r < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

export interface ArrivalEstimate {
  /** Arrival time, epoch ms, for the central parameters. */
  arrival: number;
  /** Earliest and latest arrival over the γ / w ensemble. */
  earliest: number;
  latest: number;
  /** Speed at 1 AU, km/s. */
  speedAtEarth: number;
  transitHours: number;
}

/**
 * Arrival at Earth from a launch time at r₀ (DONKI `time21_5` at 21.5 R☉).
 * Runs a small ensemble over γ and w to show the spread honestly, without a
 * single false-precision time.
 */
export function estimateArrival(
  launchMs: number,
  v0: number,
  w: number = DBM_DEFAULTS.w,
  r0: number = DBM_DEFAULTS.r0,
): ArrivalEstimate | null {
  if (!(v0 > 0)) return null;
  const central = { v0, w, gamma: DBM_DEFAULTS.gamma, r0 };
  const tc = dbmTransitTime(central);
  if (tc == null) return null;

  let earliest = Infinity;
  let latest = -Infinity;
  for (const gamma of [0.05e-7, 0.1e-7, 0.2e-7]) {
    for (const dw of [-75, 0, 75]) {
      const t = dbmTransitTime({ v0, w: Math.max(250, w + dw), gamma, r0 });
      if (t == null) continue;
      earliest = Math.min(earliest, t);
      latest = Math.max(latest, t);
    }
  }

  return {
    arrival: launchMs + tc * 1000,
    earliest: launchMs + earliest * 1000,
    latest: launchMs + latest * 1000,
    speedAtEarth: dbmState(central, tc).v,
    transitHours: tc / 3600,
  };
}

/** Front position in AU at a given time, for drawing the CME in the scene. */
export function frontPositionAu(
  launchMs: number,
  v0: number,
  atMs: number,
  w: number = DBM_DEFAULTS.w,
  r0: number = DBM_DEFAULTS.r0,
): number | null {
  if (atMs < launchMs || !(v0 > 0)) return null;
  const { r } = dbmState({ v0, w, gamma: DBM_DEFAULTS.gamma, r0 }, (atMs - launchMs) / 1000);
  return r / AU_KM;
}
