interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="btn btn--ghost"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
