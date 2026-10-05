const TONE_TEXT = {
  navy: "text-navy",
  blue: "text-blue",
  teal: "text-teal",
  green: "text-green",
  amber: "text-amber-dark",
  red: "text-red",
};

const TONE_ICON_BG = {
  navy: "border border-border bg-bg text-navy-muted",
  blue: "border border-blue/20 bg-blue-tint text-blue",
  teal: "border border-teal/20 bg-teal-tint text-teal",
  green: "border border-green/20 bg-green-tint text-green",
  amber: "border border-amber/20 bg-amber-tint text-amber-dark",
  red: "border border-red/20 bg-red-tint text-red",
};

// Compact stat tile used for forecast/operational/factor numbers.
export default function MetricCard({ label, value, unit, icon: Icon, tone = "navy", align = "center" }) {
  const isCenter = align === "center";

  return (
    <div
      className={`rounded-lg border border-border bg-surface p-3.5 shadow-soft ${
        isCenter ? "text-center" : "flex items-center gap-3"
      }`}
    >
      {Icon && !isCenter && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONE_ICON_BG[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </span>
      )}
      <div className={isCenter ? "" : "min-w-0"}>
        {Icon && isCenter && (
          <span
            className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-md ${TONE_ICON_BG[tone]}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <p className={`font-mono text-2xl font-bold tracking-tight sm:text-[1.65rem] ${TONE_TEXT[tone]}`}>
          {value}
          {unit && <span className="ml-1 text-xs font-semibold text-navy-soft sm:text-sm">{unit}</span>}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-wider text-navy-soft">{label}</p>
      </div>
    </div>
  );
}
