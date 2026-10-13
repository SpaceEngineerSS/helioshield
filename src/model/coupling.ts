import { DYN_PRESSURE_COEFF } from './constants';

/**
 * IMF clock angle in the GSM y–z plane, 0 (due north) … π (due south).
 */
export function clockAngle(by: number, bz: number): number {
  return Math.atan2(Math.abs(by), bz);
}

/**
 * Newell et al. (2007) coupling function dΦ_MP/dt.
 *
 *   v^(4/3) · B_T^(2/3) · sin^(8/3)(θ/2),   B_T = √(By² + Bz²)
 *
 * v in km/s, B in nT. The result is in the paper's arbitrary units
 * (≈ 10³ quiet, 10⁴ active, 10⁵ extreme).
 */
export function newellCoupling(speed: number, by: number, bz: number): number {
  if (!(speed > 0)) return 0;
  const bt = Math.hypot(by, bz);
  if (bt === 0) return 0;
  const s = Math.sin(clockAngle(by, bz) / 2);
  return Math.pow(speed, 4 / 3) * Math.pow(bt, 2 / 3) * Math.pow(s, 8 / 3);
}

/** Solar wind dynamic pressure in nPa (density in cm⁻³, speed in km/s). */
export function dynamicPressure(density: number, speed: number): number {
  return DYN_PRESSURE_COEFF * density * speed * speed;
}
