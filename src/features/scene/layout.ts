/**
 * Schematic layout shared by the 3D scene and the flat SVG fallback.
 * Nothing here is to scale: 1 AU would put L1 inside Earth's sphere.
 */

export const SUN_X = -7;
export const EARTH_X = 6;
export const L1_X = 1;
export const SUN_R = 1.15;
export const EARTH_R = 0.3;
/** Scene units per Earth radius, for the magnetopause. */
export const RE = EARTH_R;

/** Heliocentric distance (AU) → x along the Sun–Earth line. */
export function auToX(au: number): number {
  return SUN_X + au * (EARTH_X - SUN_X);
}

/** CME axis direction with Earth along +x: Stonyhurst longitude/latitude in degrees. */
export function cmeDirection(lat: number | null, lon: number | null): [number, number, number] {
  const la = ((lat ?? 0) * Math.PI) / 180;
  const lo = ((lon ?? 0) * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}
