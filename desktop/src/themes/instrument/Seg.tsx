/**
 * Seven-segment readout. Unlit "8"s are drawn behind the lit digits, padded to a fixed
 * number of positions (`glass`), so the glass never changes width: a 10-hour day lights
 * a digit that was always there. Colour comes from --lit. Decorative: the caller
 * supplies the accessible text.
 */
function Seg({ value, glass, className = "" }: { value: string; glass: string; className?: string }) {
  const ghost = value.replace(/\d/g, "8").padStart(glass.length, "8");
  return (
    <span className={`seg ${className}`} aria-hidden="true">
      <span className="seg-ghost">{ghost}</span>
      <span className="seg-lit">
        {value.split(/(:)/).map((part, i) => (part === ":" ? <span key={i} className="colon">:</span> : part))}
      </span>
    </span>
  );
}

export default Seg;
