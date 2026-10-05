import React from "react";
import { Link } from "react-router-dom";
import { Activity, Sliders, ArrowRight, CheckCircle2 } from "lucide-react";
import { useERContext } from "../../context/ERContext";

export default function CentralContextBanner({ moduleName = "Current Module" }) {
  const { operationalState, lastUpdated, hasRunPredictions } = useERContext();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-blue">
          <Activity className="h-4 w-4" strokeWidth={2} />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-navy">
              Centralized Operational Context
            </span>
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-bold border ${
              hasRunPredictions && lastUpdated
                ? "bg-green-tint text-green border-green/30"
                : "bg-amber-tint text-amber-dark border-amber/30"
            }`}>
              <CheckCircle2 className="h-3 w-3" />
              {hasRunPredictions && lastUpdated ? `Synced ${lastUpdated}` : "Predictions Pending"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-navy-soft">
            <span className="font-semibold text-navy">Occupancy:</span> {operationalState.occupancy_percent}% |{" "}
            <span className="font-semibold text-navy">Waiting Queue:</span> {operationalState.patients_waiting} pts |{" "}
            <span className="font-semibold text-navy">Arrival Velocity:</span> {operationalState.arrival_rate} pts/hr |{" "}
            <span className="font-semibold text-navy">Staffing:</span> {operationalState.available_doctors} docs / {operationalState.available_nurses} nurses
          </p>
        </div>
      </div>

      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-md border border-blue/30 bg-blue-tint px-3 py-1.5 text-[12px] font-semibold text-blue hover:bg-blue hover:text-white transition-colors shrink-0"
      >
        <Sliders className="h-3.5 w-3.5" />
        <span>Modify in Overview</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
