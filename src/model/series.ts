/** Helpers for sorted time series stored as parallel arrays. */

/** First index whose time is ≥ x (t must be ascending). */
export function lowerBound(t: ArrayLike<number>, x: number): number {
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (t[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the last sample at or before x, or -1. */
export function indexAt(t: ArrayLike<number>, x: number): number {
  return lowerBound(t, x + 1) - 1;
}

/** Last non-null value at or before index i, scanning back at most `maxBack` samples. */
export function lastValid<T>(values: ArrayLike<T | null>, i: number, maxBack = 30): { value: T; index: number } | null {
  for (let k = i; k >= 0 && i - k <= maxBack; k--) {
    const v = values[k];
    if (v != null) return { value: v, index: k };
  }
  return null;
}

/** Min/max ignoring nulls. Returns null when there is nothing to measure. */
export function extent(values: ArrayLike<number | null>, from = 0, to = values.length): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = from; i < to; i++) {
    const v = values[i];
    if (v == null) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return lo === Infinity ? null : [lo, hi];
}
