/**
 * Does a CME cone include Earth?
 *
 * DONKI gives the cone axis in Stonyhurst heliographic coordinates
 * (latitude, longitude, Earth at longitude 0) plus the cone half-angle. Earth
 * sits at heliographic latitude B₀, which swings ±7.25° over the year.
 */

const DEG = Math.PI / 180;

/** Heliographic latitude of the sub-Earth point (solar B₀ angle), degrees. */
export function solarB0(ms: number): number {
  const start = Date.UTC(new Date(ms).getUTCFullYear(), 0, 0);
  const doy = (ms - start) / 86_400_000;
  return 7.25 * Math.sin((2 * Math.PI * (doy - 158)) / 365.25);
}

/** Great-circle angle between two points on a sphere, degrees. */
export function angularSeparation(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(((lat2 - lat1) * DEG) / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(((lon2 - lon1) * DEG) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / DEG;
}

export type EarthImpact = 'direct' | 'flank' | 'miss' | 'unknown';

/**
 * - direct: Earth lies in the inner 60% of the cone
 * - flank:  inside the cone, or within 5° of its edge
 * - miss:   clearly outside
 */
export function classifyImpact(
  lat: number | null,
  lon: number | null,
  halfAngle: number | null,
  atMs: number,
): { impact: EarthImpact; separation: number | null } {
  if (lat == null || lon == null || halfAngle == null) return { impact: 'unknown', separation: null };
  const sep = angularSeparation(lat, lon, solarB0(atMs), 0);
  if (sep <= 0.6 * halfAngle) return { impact: 'direct', separation: sep };
  if (sep <= halfAngle + 5) return { impact: 'flank', separation: sep };
  return { impact: 'miss', separation: sep };
}
