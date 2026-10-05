import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

const TONE_CLASS = {
  navy: "border border-border bg-bg text-navy-muted",
  blue: "border border-blue/30 bg-blue-tint text-blue",
  teal: "border border-teal/30 bg-teal-tint text-teal",
  green: "border border-green/30 bg-green-tint text-green",
  amber: "border border-amber/40 bg-amber-tint text-amber-dark",
  red: "border border-red/30 bg-red-tint text-red",
};

// Levels used across the ER risk/forecast modules, mapped to a tone so
// callers can just pass a level string (e.g. crowding risk, wait trend).
export const LEVEL_TONE = {
  LOW: "green",
  MODERATE: "amber",
  HIGH: "red",
  CRITICAL: "red",
};

const TREND_ICON = {
  increasing: ArrowUpRight,
  decreasing: ArrowDownRight,
  stable: ArrowRight,
};

// Generic pill badge for statuses, risk levels, and trends.
// Pass `tone` directly, or `level` to auto-resolve tone via LEVEL_TONE.
export default function StatusBadge({ label, tone, level, trend, size = "md" }) {
  const resolvedTone = tone || (level && LEVEL_TONE[level.toUpperCase()]) || "navy";
  const text = label ?? level ?? trend;
  const TrendIcon = trend ? TREND_ICON[trend.toLowerCase()] : null;
  const sizeClass = size === "lg" ? "px-3 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold ${sizeClass} ${TONE_CLASS[resolvedTone]}`}
    >
      {TrendIcon && <TrendIcon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />}
      {text}
    </span>
  );
}
