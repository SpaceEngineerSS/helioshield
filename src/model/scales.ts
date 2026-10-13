/** NOAA radio blackout scale from GOES 0.1–0.8 nm flux (W/m²). */
export function rScale(flux: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (flux >= 2e-3) return 5;
  if (flux >= 1e-3) return 4;
  if (flux >= 1e-4) return 3;
  if (flux >= 5e-5) return 2;
  if (flux >= 1e-5) return 1;
  return 0;
}

/** Flare class string (C3.4, M1.0, X9.3) from flux. */
export function flareClass(flux: number): string {
  const bands: [string, number][] = [
    ['X', 1e-4],
    ['M', 1e-5],
    ['C', 1e-6],
    ['B', 1e-7],
    ['A', 1e-8],
  ];
  for (const [letter, base] of bands) {
    if (flux >= base) return `${letter}${(Math.floor((flux / base) * 10) / 10).toFixed(1)}`;
  }
  return 'A0.0';
}

/** Flux from a class string. Returns null for anything unparseable. */
export function classToFlux(cls: string): number | null {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(cls.trim().toUpperCase());
  if (!m) return null;
  const base = { A: 1e-8, B: 1e-7, C: 1e-6, M: 1e-5, X: 1e-4 }[m[1] as 'A' | 'B' | 'C' | 'M' | 'X'];
  return base * Number(m[2]);
}

export type Level = 0 | 1 | 2 | 3 | 4 | 5;
