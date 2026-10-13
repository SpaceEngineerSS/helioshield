/**
 * Solar elevation angle, from the NOAA Solar Calculator equations (low-precision
 * form, good to a few tenths of a degree). Used only to find darkness windows.
 */

const DEG = Math.PI / 180;

export function solarElevation(ms: number, lat: number, lon: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const ha = (gmst + lon) * DEG - ra;
  const sinEl = Math.sin(lat * DEG) * Math.sin(dec) + Math.cos(lat * DEG) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG;
}

export interface DarkWindow {
  start: number;
  end: number;
}

/**
 * The next stretch, within `horizonH` hours, where the sun is at least
 * `depression` degrees below the horizon. Null under midnight sun.
 */
export function nextDarkWindow(fromMs: number, lat: number, lon: number, depression = 12, horizonH = 30): DarkWindow | null {
  const step = 10 * 60_000;
  const end = fromMs + horizonH * 3_600_000;
  let start: number | null = null;
  for (let t = fromMs; t <= end; t += step) {
    const dark = solarElevation(t, lat, lon) <= -depression;
    if (dark && start == null) start = t;
    if (!dark && start != null) return { start, end: t };
  }
  return start != null ? { start, end } : null;
}

/** Point on Earth where the sun is overhead, degrees [lat, lon]. */
export function subsolarPoint(ms: number): [number, number] {
  const n = ms / 86_400_000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  let lon = (ra / DEG - gmst) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return [dec / DEG, lon];
}
