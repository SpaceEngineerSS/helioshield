/** Chart colours, read from the live CSS tokens so both themes stay in sync. */
export interface ChartColors {
  text: string;
  text2: string;
  text3: string;
  rule: string;
  ruleStrong: string;
  grid: string;
  sun: string;
  sunDim: string;
  south: string;
  north: string;
  model: string;
  lv: string[];
  font: string;
}

export function readChartColors(): ChartColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    text: v('--text'),
    text2: v('--text-2'),
    text3: v('--text-3'),
    rule: v('--rule-c'),
    ruleStrong: v('--rule-strong'),
    grid: v('--grid-c'),
    sun: v('--sun'),
    sunDim: v('--sun-dim'),
    south: v('--south'),
    north: v('--north'),
    model: v('--model'),
    lv: [0, 1, 2, 3, 4, 5].map((i) => v(`--lv${i}`)),
    font: v('--font-mono') || 'monospace',
  };
}

/** Same colour with a new alpha, for fills. Accepts #rrggbb or rgb()/rgba(). */
export function withAlpha(color: string, a: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return color;
}
