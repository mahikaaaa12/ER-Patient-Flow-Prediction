import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

const TONE_CLASS = {
  navy: "bg-navy/5 text-navy",
  blue: "bg-blue-tint text-blue",
  teal: "bg-teal-tint text-teal",
  green: "bg-green-tint text-green",
  amber: "bg-amber-tint text-amber",
  red: "bg-red-tint text-red",
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
  const sizeClass = size === "lg" ? "px-3.5 py-2 text-[13.5px]" : "px-2.5 py-1 text-[12px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${TONE_CLASS[resolvedTone]}`}
    >
      {TrendIcon && <TrendIcon className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />}
      {text}
    </span>
  );
}
