export interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** demo: dev bar · ws: sidebar workspaces · choice: settings · fill: panels */
  variant: 'demo' | 'ws' | 'choice' | 'fill';
  label?: string;
}

export function Segmented<T extends string>({ options, value, onChange, variant, label }: Props<T>) {
  return (
    <div className={`seg ${variant}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : undefined}
          title={variant === 'ws' ? o.label : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const opts = <T extends string>(pairs: [T, string][]): SegOption<T>[] =>
  pairs.map(([value, label]) => ({ value, label }));
