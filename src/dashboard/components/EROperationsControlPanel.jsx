import React, { useState } from "react";
import { Sliders, RefreshCw, CheckCircle2, Play, Activity, Cpu } from "lucide-react";
import StepperControl from "./StepperControl";
import { useERContext } from "../../context/ERContext";
import { useMode } from "../../context/ModeContext";

export default function EROperationsControlPanel({ className = "" }) {
  const { isRealMode } = useMode();
  const {
    operationalState,
    setOperationalState,
    updatePredictions,
    loading,
    error,
    lastUpdated,
    modelStatus,
  } = useERContext();

  const [form, setForm] = useState(operationalState);

  const handleChange = (field, val) => {
    const updated = { ...form, [field]: val };
    setForm(updated);
    setOperationalState(updated);
  };

  const handleUpdateAll = async (e) => {
    e.preventDefault();
    await updatePredictions(form);
  };

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 shadow-soft sm:p-5 ${className}`}>
      {/* HEADER */}
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-blue">
            <Sliders className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-navy">ER Operations Control Panel</h2>
              <span className="rounded border border-blue/30 bg-blue-tint px-2 py-0.5 text-[10px] font-bold text-blue uppercase">
                Central Command
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-navy-soft">
              Update central ER operational variables to synchronize all 5 ML prediction engines
            </p>
          </div>
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-1.5 rounded-md border border-green/30 bg-green-tint px-2.5 py-1 text-[11.5px] font-semibold text-green shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green" />
            <span>Synced at {lastUpdated}</span>
          </div>
        )}
      </div>

      {/* FORM INPUTS GRID */}
      <form onSubmit={handleUpdateAll} className="mt-3.5 flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {/* SECTION 1: CURRENT ER STATUS */}
          <div className="rounded-md border border-border/80 bg-bg/50 p-3">
            <div className="mb-2.5 flex items-center gap-1.5 border-b border-border/50 pb-1.5">
              <Activity className="h-3.5 w-3.5 text-blue" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-navy">
                1. Current ER Operational Status
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <StepperControl
                label="ER Occupancy"
                value={form.occupancy_percent}
                onChange={(val) => handleChange("occupancy_percent", val)}
                min={20}
                max={100}
                step={1}
                unit="%"
              />
              <StepperControl
                label="Patients Waiting"
                value={form.patients_waiting}
                onChange={(val) => handleChange("patients_waiting", val)}
                min={0}
                max={80}
                step={1}
                unit="pts"
              />
              <StepperControl
                label="Available Beds"
                value={form.available_beds}
                onChange={(val) => handleChange("available_beds", val)}
                min={0}
                max={40}
                step={1}
                unit="beds"
              />
            </div>
          </div>

          {/* SECTION 2: DEMAND & STAFFING */}
          <div className="rounded-md border border-border/80 bg-bg/50 p-3">
            <div className="mb-2.5 flex items-center gap-1.5 border-b border-border/50 pb-1.5">
              <Cpu className="h-3.5 w-3.5 text-teal" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-navy">
                2. Patient Demand & Staffing Inputs
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
              <StepperControl
                label="Arrival Velocity"
                value={form.arrival_rate}
                onChange={(val) => handleChange("arrival_rate", val)}
                min={5}
                max={60}
                step={1}
                unit="pts/hr"
              />
              <StepperControl
                label="Severity Acuity"
                value={form.severity_level}
                onChange={(val) => handleChange("severity_level", val)}
                min={1}
                max={5}
                step={0.5}
                unit="level"
              />
              <StepperControl
                label="Active Physicians"
                value={form.available_doctors}
                onChange={(val) => handleChange("available_doctors", val)}
                min={1}
                max={20}
                step={1}
                unit="docs"
              />
              <StepperControl
                label="Active Nurses"
                value={form.available_nurses}
                onChange={(val) => handleChange("available_nurses", val)}
                min={1}
                max={40}
                step={1}
                unit="nurses"
              />
            </div>
          </div>
        </div>

        {/* PRIMARY ACTION BAR */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-navy-soft">
            <span className="font-semibold text-navy">Engine Pipelines:</span>
            {[
              { key: "forecast", label: "Forecast" },
              { key: "waiting_time", label: "Wait Time" },
              { key: "crowding_risk", label: "Crowding" },
              { key: "flow_pattern", label: "Patterns" },
              { key: "surge_detection", label: "Surge" },
            ].map(({ key, label }) => {
              const status = modelStatus?.[key];
              const isSuccess = status === "success" || status === "demo" || status === "loaded";
              const isUpdating = status === "updating" || status === "loading";
              const isFailed = status === "error" || status === "failed";

              const symbol = isSuccess ? "✓" : isUpdating ? "○" : isFailed ? "⚠" : "—";
              const cls = isSuccess
                ? "border-green/30 bg-green-tint text-green font-bold"
                : isUpdating
                ? "border-blue/30 bg-blue-tint text-blue font-semibold animate-pulse"
                : isFailed
                ? "border-red/30 bg-red-tint text-red font-bold"
                : "border-border bg-bg text-navy-muted";

              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${cls}`}
                >
                  <span>{symbol}</span>
                  <span>{label}</span>
                </span>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue px-4 py-2 text-[12.5px] font-semibold text-white shadow-soft hover:bg-blue-dark transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Updating Predictions...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Update All Predictions</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red/30 bg-red-tint p-2.5 text-[12px] font-semibold text-red">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
