import { DIPOLE_POLE_LAT_DEG, DIPOLE_POLE_LON_DEG } from './constants';

const DEG = Math.PI / 180;

/** Centred-dipole geomagnetic latitude, degrees. */
export function geomagneticLatitude(lat: number, lon: number): number {
  const s =
    Math.sin(lat * DEG) * Math.sin(DIPOLE_POLE_LAT_DEG * DEG) +
    Math.cos(lat * DEG) * Math.cos(DIPOLE_POLE_LAT_DEG * DEG) * Math.cos((lon - DIPOLE_POLE_LON_DEG) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/**
 * Lowest |geomagnetic latitude| where aurora may show on the poleward horizon,
 * by Kp. This is a rule of thumb read off the SWPC view-line charts, not a model:
 * Kp 3 ≈ 60°, Kp 5 ≈ 56°, Kp 7 ≈ 52°, Kp 9 ≈ 48°.
 */
export function viewLineLatitude(kp: number): number {
  return 66 - 2 * Math.min(9, Math.max(0, kp));
}

/** OVATION grid: 360 longitudes × 181 latitudes, value = probability in percent. */
export interface OvationGrid {
  observed: number;
  forecast: number;
  values: ArrayLike<number>;
}

export function ovationAt(grid: OvationGrid, lat: number, lon: number): number {
  const li = ((Math.round(lon) % 360) + 360) % 360;
  const la = Math.max(-90, Math.min(90, Math.round(lat))) + 90;
  return grid.values[li * 181 + la] ?? 0;
}

/**
 * Highest OVATION probability within `rangeKm` of the observer, on the poleward
 * side. Aurora at ~110 km altitude stays above the horizon out to roughly
 * 800–1000 km, so this approximates what could be seen low in the sky.
 */
export function ovationHorizon(grid: OvationGrid, lat: number, lon: number, rangeKm = 800): number {
  const sign = lat >= 0 ? 1 : -1;
  const dLat = rangeKm / 111;
  let best = 0;
  for (let k = 0; k <= Math.ceil(dLat); k++) {
    const la = lat + sign * k;
    if (Math.abs(la) > 90) break;
    const remaining = Math.sqrt(Math.max(0, dLat * dLat - k * k));
    const dLon = Math.min(180, remaining / Math.max(0.05, Math.cos(la * DEG)));
    for (let j = -Math.ceil(dLon); j <= Math.ceil(dLon); j++) {
      best = Math.max(best, ovationAt(grid, la, lon + j));
    }
  }
  return best;
}

export type AuroraChance = 'likely' | 'possible' | 'unlikely';

export function auroraChance(overhead: number, horizon: number): AuroraChance {
  if (overhead >= 30 || horizon >= 50) return 'likely';
  if (overhead >= 10 || horizon >= 20) return 'possible';
  return 'unlikely';
}
