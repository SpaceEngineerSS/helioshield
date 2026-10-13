import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: ReactNode;
  value: number | null;
  format: (v: number) => string;
  unit?: ReactNode;
  sub?: ReactNode;
  hero?: boolean;
  empty: string;
  instant?: boolean;
  color?: string;
}

export function Readout({ label, value, format, unit, sub, hero, empty, instant, color }: Props) {
  return (
    <div className={`readout ${hero ? 'readout--hero' : ''}`}>
      <span className="label">{label}</span>
      <span className="readout__value" style={color ? { color } : undefined}>
        {value == null ? (
          <span className="readout__empty">—</span>
        ) : (
          <AnimatedNumber value={value} format={format} instant={instant} />
        )}
        {unit && value != null && <span className="readout__unit">{unit}</span>}
        {value == null && <span className="sr-only">{empty}</span>}
      </span>
      {sub && <span className="readout__sub">{sub}</span>}
    </div>
  );
}
