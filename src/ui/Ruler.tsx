import { m } from 'motion/react';
import { levelColor } from './level-color';

interface Props {
  /** Official value, drawn as the amber needle. */
  value: number | null;
  /** Second reading (our model), drawn as a smaller ghost needle. */
  ghost?: number | null;
  max?: number;
  label: string;
}

/** Kp spans of the NOAA G-scale: quiet, G1 … G5 (G5 is Kp 9-, 9o). */
const BANDS: [number, number, number][] = [
  [0, 4.67, 0],
  [4.67, 5.67, 1],
  [5.67, 6.67, 2],
  [6.67, 7.67, 3],
  [7.67, 8.67, 4],
  [8.67, 9, 5],
];

/**
 * Kp gauge drawn as a ruler: ticks 0–9 with the G-scale bands underneath.
 */
export function Ruler({ value, ghost, max = 9, label }: Props) {
  const pct = (v: number) => `${(Math.min(max, Math.max(0, v)) / max) * 100}%`;
  const spring = { type: 'spring' as const, stiffness: 140, damping: 22 };
  return (
    <div className="ruler" role="img" aria-label={label}>
      {BANDS.map(([from, to, lv]) => (
        <span
          key={from}
          className="ruler__band"
          style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})`, background: levelColor(lv) }}
        />
      ))}
      <svg className="ruler__ticks" aria-hidden="true">
        {Array.from({ length: max * 3 + 1 }, (_, i) => {
          const v = i / 3;
          const major = i % 3 === 0;
          return (
            <g key={i}>
              <line x1={pct(v)} x2={pct(v)} y1={major ? 14 : 16} y2={major ? 22 : 19} />
              {major && (
                <text x={pct(v)} y={33} textAnchor="middle">
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {ghost != null && (
        <m.span className="ruler__needle ruler__ghost" initial={false} animate={{ left: pct(ghost) }} transition={spring} style={{ scale: 0.75, originY: 0 }} />
      )}
      {value != null && <m.span className="ruler__needle" initial={false} animate={{ left: pct(value) }} transition={spring} />}
    </div>
  );
}
