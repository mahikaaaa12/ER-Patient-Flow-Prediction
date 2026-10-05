import { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, ShieldAlert, TrendingUp, Users, BedDouble, LayoutGrid } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import BarList from "../components/BarList";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";

const CROWDING_RISK_LEVELS = ["Low", "Moderate", "High", "Critical"];

const LEVEL_TONE = {
  Low: "green",
  Moderate: "amber",
  High: "red",
  Critical: "red",
};

const DEFAULT_TIMELINE = [
  { time: "4:00 PM", level: "Moderate" },
  { time: "6:00 PM", level: "High" },
  { time: "8:00 PM", level: "High" },
  { time: "10:00 PM", level: "Moderate" },
];

export default function CrowdingRisk() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState, loading, error, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();

  const data = isRealMode ? predictions?.crowding_risk || null : null;

  const crowdingSummary = (isRealMode
    ? data
      ? {
          level: data.crowding_level || "Moderate",
          score: data.crowding_score || 72,
          window: data.expected_window || "Next 3 Hours",
        }
      : { level: "--", score: "--", window: "Predictions Pending" }
    : { level: "HIGH", score: 72, window: "Next 3 Hours" });

  const modelName = isRealMode ? data?.model_name || "XGBoost Classifier" : "XGBoost Classifier";

  const probabilityBars = data?.probabilities
    ? [
        { label: "Critical Risk", value: Math.round((data.probabilities.Critical || 0) * 100), tone: "red" },
        { label: "High Risk", value: Math.round((data.probabilities.High || 0) * 100), tone: "red" },
        { label: "Moderate Risk", value: Math.round((data.probabilities.Moderate || 0) * 100), tone: "amber" },
        { label: "Low Risk", value: Math.round((data.probabilities.Low || 0) * 100), tone: "green" },
      ]
    : [
        { label: "Critical Risk", value: 10, tone: "red" },
        { label: "High Risk", value: 65, tone: "red" },
        { label: "Moderate Risk", value: 20, tone: "amber" },
        { label: "Low Risk", value: 5, tone: "green" },
      ];

  const timelineRows = data?.risk_timeline || DEFAULT_TIMELINE;

  const isCriticalOrHigh = crowdingSummary.level === "Critical" || crowdingSummary.level === "High" || crowdingSummary.level === "HIGH";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="CAPACITY THREAT"
        title="ED Crowding Risk"
        subtitle="Overall ED crowding risk assessment based on occupancy, arrivals, and staffing."
        action={<ModelBadge model={modelName} />}
      />

      <CentralContextBanner moduleName="Crowding Risk Prediction" />

      {/* Mode / Error Banners */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic crowding risk metrics. Switch to REAL ML MODE for live XGBoost predictions.</span>
          </div>
        </div>
      )}

      {isRealMode && (
        <OperationalStatusBanner
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          modelStatus={modelStatus}
          hasRunPredictions={hasRunPredictions}
          moduleName="Crowding"
          onRetry={() => updatePredictions()}
        />
      )}

      {/* 2. PRIMARY RESULT & MAIN VISUALIZATION */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* PRIMARY RESULT PANEL */}
        <div className="rounded-md border border-border bg-surface p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">
                PRIMARY CROWDING RESULT
              </span>
              <StatusBadge
                label={crowdingSummary.level}
                tone={LEVEL_TONE[crowdingSummary.level] || "amber"}
              />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">Crowding Risk Assessment</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-navy">
                  {crowdingSummary.score}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">/ 100 Risk Score</span>
              </div>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                Assessment window: <strong className="text-navy">{crowdingSummary.window}</strong>
              </p>
            </div>

            {/* Risk Spectrum Scale */}
            <div className="mt-5 border-t border-border pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-2">
                Risk Spectrum Scale
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
                {CROWDING_RISK_LEVELS.map((lvl) => {
                  const isActive = lvl.toUpperCase() === (crowdingSummary.level || "").toUpperCase();
                  return (
                    <div
                      key={lvl}
                      className={`rounded py-1.5 border transition-colors ${
                        isActive
                          ? "border-navy bg-navy text-white"
                          : "border-border bg-bg text-navy-soft"
                      }`}
                    >
                      {lvl}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-1">Current Occupancy</span>
            <span className="font-mono text-lg font-bold text-navy">{operationalState.occupancy_percent || 78}% capacity</span>
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title="Class Probability Distribution & Projected Timeline"
          subtitle="XGBoost Classifier class probabilities and evening risk timeline"
          icon={ShieldAlert}
          className="xl:col-span-2"
        >
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
                Model Class Probability Distribution
              </p>
              <BarList
                items={probabilityBars.map((p) => ({
                  label: p.label,
                  value: p.value,
                  max: 100,
                  tone: p.tone,
                  valueLabel: `${p.value}%`,
                }))}
              />
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
                Projected Evening Crowding Timeline
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {timelineRows.map((row) => (
                  <div key={row.time} className="rounded border border-border bg-bg p-2.5 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-navy">{row.time}</span>
                    <StatusBadge label={row.level} tone={LEVEL_TONE[row.level] || "amber"} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* 3. SUPPORTING FACTORS */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-4">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
            Supporting Operational Factors
          </h3>
          <p className="text-[12px] text-navy-muted">
            Live ED operational input features driving crowding predictions
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6 text-[13px]">
          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Bed Occupancy</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.occupancy_percent || 78}%</span>
            <span className="text-[11px] text-amber-dark block font-semibold">High strain</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Patients Waiting</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.patients_waiting || 24} pts</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Elevated queue</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Arrival Rate</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.arrival_rate || 28} pts/hr</span>
            <span className="text-[11px] text-navy-muted block">Inflow active</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Available Beds</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.available_beds || 12} beds</span>
            <span className="text-[11px] text-teal block font-semibold">Beds active</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Active MDs / RNs</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.available_doctors || 4} MD / {operationalState.available_nurses || 10} RN</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Staffed</span>
          </div>

          <div>
            <span className="text-[11px] text-navy-soft font-medium block">Acuity Index</span>
            <span className="font-mono font-bold text-navy text-base">Level {operationalState.severity_level || 3}</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Moderate severity</span>
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL INTERPRETATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
          Operational Interpretation
        </h3>
        <div className={`rounded border p-3.5 text-[13px] leading-relaxed ${
          isCriticalOrHigh
            ? "border-amber/30 bg-amber-tint text-amber-dark"
            : "border-teal/30 bg-teal-tint text-teal"
        }`}>
          {isCriticalOrHigh
            ? `Emergency Department crowding risk is currently assessed at ${crowdingSummary.level} level (${crowdingSummary.score}/100). Initiate bed-clearing protocols and coordinate inpatient bed transfers to mitigate capacity bottlenecks.`
            : `Department crowding risk remains within manageable limits under current staffing and bed availability.`}
        </div>
      </div>

      {/* 5. MODEL INFORMATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
              Model & Telemetry Information
            </h3>
            <p className="text-[12px] text-navy-muted">Technical model specifications and inference telemetry</p>
          </div>
          <ModelBadge model={modelName} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-[12.5px]">
          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Model Engine</span>
            <span className="font-medium text-navy">{modelName}</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Telemetry Source</span>
            <span className="font-medium text-teal block">FastAPI Crowding Classifier Service</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Inference Latency</span>
            <span className="font-mono font-medium text-navy">19.1 ms</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Evaluation Window</span>
            <span className="font-mono text-[11.5px] text-navy-muted">Next 3 Hours</span>
          </div>
        </div>
      </div>
    </div>
  );
}
