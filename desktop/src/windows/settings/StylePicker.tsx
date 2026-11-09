import { THEMES } from "../../themes/registry";

type Props = { value: string; labelledBy: string; onPick: (id: string) => void };

/** A segmented switch with one option per registered pill theme. Picking one switches the pill. */
function StylePicker({ value, labelledBy, onPick }: Props) {
  // An unknown saved id shows the theme the pill actually falls back to.
  const current = THEMES.some((t) => t.id === value) ? value : THEMES[0].id;
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={labelledBy}>
      {THEMES.map((t) => (
        <label key={t.id} title={t.blurb}>
          <input type="radio" name="pill-style" className="sr-only" checked={current === t.id} onChange={() => onPick(t.id)} />
          <span>{t.name}</span>
        </label>
      ))}
    </div>
  );
}

export default StylePicker;
