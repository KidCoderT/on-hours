import type { CSSProperties } from "react";
import { pillWidth, themeById } from "@app/themes/registry";
import type { PillModel } from "@app/themes/types";

type Props = { theme: string; model: PillModel; className?: string };

/** The app's real pill at its real window size (48px tall). CSS scales it through --s on the class. */
export function DemoPill({ theme, model, className }: Props) {
  const t = themeById(theme);
  const width = pillWidth(t, model.showSettingsButton);
  return (
    <div className={`demo-pill ${className ?? ""}`} style={{ "--w": `${width}px` } as CSSProperties}>
      <div className="demo-pill-inner">
        <t.Pill m={model} />
      </div>
    </div>
  );
}
