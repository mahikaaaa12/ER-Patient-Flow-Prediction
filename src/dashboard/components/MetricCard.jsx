const TONE_TEXT = {
  navy: "text-navy",
  blue: "text-blue",
  teal: "text-teal",
  green: "text-green",
  amber: "text-amber",
  red: "text-red",
};

const TONE_ICON_BG = {
  navy: "bg-navy/5 text-navy",
  blue: "bg-blue-tint text-blue",
  teal: "bg-teal-tint text-teal",
  green: "bg-green-tint text-green",
  amber: "bg-amber-tint text-amber",
  red: "bg-red-tint text-red",
};

// Compact stat tile used for forecast/operational/factor numbers.
// align: "center" (default, matches the existing forecast-card style) | "left"
export default function MetricCard({ label, value, unit, icon: Icon, tone = "navy", align = "center" }) {
  const isCenter = align === "center";

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 shadow-soft ${
        isCenter ? "text-center" : "flex items-center gap-3.5"
      }`}
    >
      {Icon && !isCenter && (
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_BG[tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        </span>
      )}
      <div className={isCenter ? "" : "min-w-0"}>
        {Icon && isCenter && (
          <span
            className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${TONE_ICON_BG[tone]}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
        )}
        <p className={`font-mono text-2xl font-semibold sm:text-3xl ${TONE_TEXT[tone]}`}>
          {value}
          {unit && <span className="ml-1 text-sm font-medium text-navy-soft sm:text-base">{unit}</span>}
        </p>
        <p className="mt-1 truncate text-[12px] font-medium text-navy-soft">{label}</p>
      </div>
    </div>
  );
}
