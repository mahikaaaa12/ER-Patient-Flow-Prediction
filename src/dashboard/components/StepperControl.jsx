import React from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Reusable StepperControl component replacing range/slider controls across ERFlow.
 * Provides compact, accessible, precise +/- numerical stepping.
 */
export default function StepperControl({
  label,
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  disabled = false,
  description,
  error,
}) {
  const numericValue = typeof value === "number" && !Number.isNaN(value) ? value : 0;
  const isMin = numericValue <= min;
  const isMax = numericValue >= max;

  const handleDecrement = (e) => {
    e?.preventDefault();
    if (disabled || isMin) return;
    const nextVal = Math.max(min, Math.round((numericValue - step) * 1000) / 1000);
    onChange?.(nextVal);
  };

  const handleIncrement = (e) => {
    e?.preventDefault();
    if (disabled || isMax) return;
    const nextVal = Math.min(max, Math.round((numericValue + step) * 1000) / 1000);
    onChange?.(nextVal);
  };

  // Format value display based on unit
  const formatDisplay = () => {
    if (unit === ":00") {
      const padded = String(Math.floor(numericValue)).padStart(2, "0");
      return `${padded}:00`;
    }
    if (unit === "%") {
      return `${numericValue}%`;
    }
    if (unit) {
      return `${numericValue} ${unit}`;
    }
    return `${numericValue}`;
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-navy-soft">
            {label}
          </label>
          {description && (
            <span className="text-[11px] font-medium text-navy-muted">{description}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2 shadow-sm transition-all focus-within:border-blue">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || isMin}
          aria-label={`Decrease ${label || "value"}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-card text-navy transition-colors hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue"
        >
          <Minus className="h-4 w-4 stroke-[2.5]" />
        </button>

        <div className="px-3 text-center">
          <span className="font-mono text-[17px] font-bold text-navy tracking-tight">
            {formatDisplay()}
          </span>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || isMax}
          aria-label={`Increase ${label || "value"}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-card text-navy transition-colors hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>

      {error && <p className="mt-0.5 text-[11px] font-medium text-red">{error}</p>}
    </div>
  );
}
