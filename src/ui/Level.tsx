import { levelColor } from './level-color';

/** NOAA scale chip, e.g. [G2 | moderate]. */
export function Level({ letter, n, name }: { letter: 'G' | 'R' | 'S'; n: number; name: string }) {
  return (
    <span className="level" style={{ ['--lv' as string]: levelColor(n) }}>
      <span className="level__code">
        {letter}
        {n}
      </span>
      <span className="level__name">{name}</span>
    </span>
  );
}
