/**
 * Shue et al. (1998) magnetopause model, JGR 103(A8), 17691.
 *
 *   r(θ) = r₀ · (2 / (1 + cos θ))^α
 *   r₀ = (10.22 + 1.29 tanh(0.184 (Bz + 8.14))) · Dp^(−1/6.6)
 *   α  = (0.58 − 0.007 Bz) · (1 + 0.024 ln Dp)
 *
 * Bz in nT (GSM), Dp in nPa, r in Earth radii.
 */
export interface Magnetopause {
  r0: number;
  alpha: number;
}

export function shue1998(bz: number, dp: number): Magnetopause {
  const p = Math.min(Math.max(dp, 0.1), 100);
  const b = Math.min(Math.max(bz, -50), 50);
  const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (b + 8.14))) * Math.pow(p, -1 / 6.6);
  const alpha = (0.58 - 0.007 * b) * (1 + 0.024 * Math.log(p));
  return { r0, alpha };
}

export function magnetopauseRadius({ r0, alpha }: Magnetopause, theta: number): number {
  return r0 * Math.pow(2 / (1 + Math.cos(theta)), alpha);
}

/** Geosynchronous orbit radius in Earth radii; a standoff inside it matters for GEO satellites. */
export const GEO_ORBIT_RE = 6.6;
