/** CSS colour for a NOAA scale level 0–5. */
export function levelColor(n: number): string {
  return `var(--lv${Math.max(0, Math.min(5, Math.round(n)))})`;
}
