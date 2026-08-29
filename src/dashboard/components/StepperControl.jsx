import React from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Reusable compact StepperControl component across ERFlow.
 * Provides precise +/- numerical stepping with compact, modern dashboard styling.
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

  // Format value & unit typography
  const renderValueAndUnit = () => {
    if (unit === ":00") {
      const padded = String(Math.floor(numericValue)).padStart(2, "0");
      return (
        <span className="font-mono text-[13px] font-bold text-navy">
          {padded}:00
        </span>
      );
    }
    if (unit === "%") {
      return (
        <span className="font-mono text-[13px] font-bold text-navy">
          {numericValue}
          <span className="ml-0.5 text-[11px] font-semibold text-navy-soft">%</span>
        </span>
      );
    }
    if (unit) {
      return (
        <span className="font-mono text-[13px] font-bold text-navy">
          {numericValue}{" "}
          <span className="text-[10.5px] font-medium text-navy-muted">{unit}</span>
        </span>
      );
    }
    return (
      <span className="font-mono text-[13px] font-bold text-navy">
        {numericValue}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-navy-soft truncate">
            {label}
          </label>
          {description && (
            <span className="text-[10px] font-medium text-navy-muted truncate">{description}</span>
          )}
        </div>
      )}

      <div className="flex h-9 items-center justify-between rounded-lg border border-border/80 bg-surface px-1.5 shadow-none transition-all hover:border-blue/40 focus-within:border-blue">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || isMin}
          aria-label={`Decrease ${label || "value"}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-bg text-navy transition-colors hover:bg-blue-tint hover:text-blue disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
        >
          <Minus className="h-3 w-3 stroke-[2.25]" />
        </button>

        <div className="px-1.5 text-center truncate">
          {renderValueAndUnit()}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || isMax}
          aria-label={`Increase ${label || "value"}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-bg text-navy transition-colors hover:bg-blue-tint hover:text-blue disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none"
        >
          <Plus className="h-3 w-3 stroke-[2.25]" />
        </button>
      </div>

      {error && <p className="mt-0.5 text-[10.5px] font-medium text-red">{error}</p>}
    </div>
  );
}
