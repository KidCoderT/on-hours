type Props<T extends string> = { name: string; label: string; value: T; options: readonly { id: T; label: string }[]; onPick: (id: T) => void };

/** The app's segmented control (same markup and class as its settings window). */
export function Segmented<T extends string>({ name, label, value, options, onPick }: Props<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.id}>
          <input type="radio" name={name} className="sr-only" checked={value === o.id} onChange={() => onPick(o.id)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
