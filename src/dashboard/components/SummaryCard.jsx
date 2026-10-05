import { ArrowUpRight, ArrowDownRight, HelpCircle } from "lucide-react";

const TONE = {
  blue: { icon: "text-blue", bg: "border border-blue/20 bg-blue-tint" },
  teal: { icon: "text-teal", bg: "border border-teal/20 bg-teal-tint" },
  green: { icon: "text-green", bg: "border border-green/20 bg-green-tint" },
  amber: { icon: "text-amber-dark", bg: "border border-amber/20 bg-amber-tint" },
  red: { icon: "text-red", bg: "border border-red/20 bg-red-tint" },
};

export default function SummaryCard({ label, value, trend, trendDirection, tone = "blue", icon: Icon, onExplain }) {
  const t = TONE[tone] || TONE.blue;
  const TrendIcon = trendDirection === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-navy-soft min-w-0 flex-1 truncate">{label}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {onExplain && (
            <button
              type="button"
              onClick={onExplain}
              className="inline-flex items-center gap-1 rounded border border-blue/30 bg-blue-tint px-1.5 py-0.5 text-[10.5px] font-bold text-blue hover:bg-blue hover:text-white transition-colors"
              title="Click to view TreeSHAP feature attributions"
            >
              <HelpCircle className="h-3 w-3" /> Why?
            </button>
          )}
          {Icon && (
            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${t.bg} ${t.icon}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
      <p className="mt-2.5 font-mono text-2xl font-bold tracking-tight text-navy sm:text-3xl">{value}</p>
      {trend && (
        <p
          className={`mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium ${
            trendDirection === "down" ? "text-green font-semibold" : "text-navy-soft"
          }`}
        >
          <TrendIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          {trend}
        </p>
      )}
    </div>
  );
}
