import "@app/windows/bubble/bubble.css";

type Props = { title: string; sub: string; buttons?: [string, string]; primary?: 0 | 1; theme?: string };

/**
 * A still of the app's away bubble (windows/bubble/BubbleWindow.tsx), with its own CSS. Inert: the
 * text around it says what the answers do.
 */
export function Bubble({ title, sub, buttons, primary = 0, theme = "baseline" }: Props) {
  return (
    <div className="site-bubble" inert aria-hidden="true">
      <div className="bubble" data-theme={theme}>
        <p className="bubble-title">{title}</p>
        <p className="bubble-sub">{sub}</p>
        {buttons && (
          <div className="bubble-actions">
            {buttons.map((label, i) => <button type="button" key={label} className={i === primary ? "bubble-primary" : undefined}>{label}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
