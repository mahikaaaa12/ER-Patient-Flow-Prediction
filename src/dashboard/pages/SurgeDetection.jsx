import { useState } from "react";
import { AlertOctagon, AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import AnomalyTimeline from "../components/AnomalyTimeline";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";
import {
  SURGE_STATUS as MOCK_STATUS,
  SURGE_DETECTION_MODEL as MOCK_MODEL,
} from "../mockData";

const DEFAULT_TIMELINE = [
  { t: "3 PM", expected: 13, actual: 14, anomaly: false },
  { t: "4 PM", expected: 14, actual: 15, anomaly: false },
  { t: "5 PM", expected: 14, actual: 18, anomaly: false },
  { t: "6 PM", expected: 15, actual: 27, anomaly: true },
  { t: "6:30 PM", expected: 15, actual: 32, anomaly: true },
  { t: "7 PM (proj.)", expected: 14, actual: 29, anomaly: true },
];

const SEVERITY_TONE = { High: "red", Moderate: "amber", Low: "green" };

export default function SurgeDetection() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState, loading, error, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();

  const data = isRealMode ? predictions?.surge_detection || null : null;

  const surgeStatus = (isRealMode
    ? data
      ? {
          status: data.status,
          severity: data.severity,
          normalRateValue: data.normal_arrival_rate || 28,
          currentRateValue: `${Math.round(data.current_arrival_rate)}`,
          rateUnit: "patients/hr",
          deviation: data.deviation_percent,
          detectedAt: data.detected_at,
          description: data.description,
          isSurge: data.is_surge,
        }
      : {
          status: "--",
          severity: "--",
          normalRateValue: "--",
          currentRateValue: "--",
          rateUnit: "pts/hr",
          deviation: "--",
          detectedAt: "--",
          description: "Predictions pending.",
          isSurge: false,
        }
    : {
        ...MOCK_STATUS,
        isSurge: MOCK_STATUS.severity === "High" || MOCK_STATUS.severity === "Moderate",
      });

  const modelName = isRealMode ? data?.model_name || "DBSCAN Density Anomaly" : MOCK_MODEL;
  const timelineData = data?.timeline || DEFAULT_TIMELINE;
  const isSurge = surgeStatus.isSurge || surgeStatus.severity === "High" || surgeStatus.severity === "Moderate";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="ANOMALY DETECTION"
        title="Patient Surge Detection"
        subtitle="Abnormal spikes in patient arrival velocity compared against expected operational baselines."
        action={<ModelBadge model={modelName} />}
      />

      <CentralContextBanner moduleName="Patient Surge Anomaly Detection" />

      {/* Mode / Error Banners */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic surge detection metrics. Switch to REAL ML MODE for live operational anomaly detection.</span>
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
          moduleName="Surge"
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
                PRIMARY SURGE ANOMALY RESULT
              </span>
              <StatusBadge
                label={isSurge ? `${surgeStatus.severity} Surge` : "Normal Baseline"}
                tone={isSurge ? (SEVERITY_TONE[surgeStatus.severity] || "red") : "green"}
              />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">Current Arrival Velocity</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-navy">
                  {surgeStatus.currentRateValue}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">patients/hour</span>
              </div>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                Deviation: <strong className={isSurge ? "text-red font-semibold" : "text-navy"}>{surgeStatus.deviation}</strong>
              </p>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-2">
                Anomaly Parameters
              </span>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded border border-border bg-bg p-2.5">
                  <span className="text-[10.5px] font-semibold text-navy-soft block">Expected Baseline</span>
                  <span className="font-mono font-bold text-navy">{surgeStatus.normalRateValue || 28} pts/hr</span>
                </div>
                <div className="rounded border border-border bg-bg p-2.5">
                  <span className="text-[10.5px] font-semibold text-navy-soft block">Detection Time</span>
                  <span className="font-mono font-bold text-navy">{surgeStatus.detectedAt || "Live Stream"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-1">DBSCAN Density Window</span>
            <span className="font-mono text-xs text-navy-muted">eps = 0.5 | min_samples = 5</span>
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title="Arrival Velocity vs Baseline Threshold"
          subtitle="Observed arrival rate compared against upper baseline anomaly boundaries"
          icon={AlertOctagon}
          className="xl:col-span-2"
        >
          <AnomalyTimeline data={timelineData} />
        </ChartCard>
      </div>

      {/* 3. SUPPORTING FACTORS */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-4">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
            Supporting Operational Factors
          </h3>
          <p className="text-[12px] text-navy-muted">
            Arrival velocity metrics evaluated by DBSCAN density anomaly clustering
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 text-[13px]">
          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Observed Velocity</span>
            <span className="font-mono font-bold text-navy text-base">{surgeStatus.currentRateValue} pts/hr</span>
            <span className="text-[11px] text-red block font-semibold">Elevated spike</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Expected Baseline</span>
            <span className="font-mono font-bold text-navy text-base">{surgeStatus.normalRateValue || 28} pts/hr</span>
            <span className="text-[11px] text-navy-muted block">Seasonal threshold</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Velocity Deviation</span>
            <span className="font-mono font-bold text-navy text-base">{surgeStatus.deviation}</span>
            <span className="text-[11px] text-red block font-semibold">Abnormal influx</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Waiting Population</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState?.patients_waiting || 24} pts</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Active queue strain</span>
          </div>

          <div>
            <span className="text-[11px] text-navy-soft font-medium block">Severity Level</span>
            <span className="font-semibold text-navy text-base">{surgeStatus.severity}</span>
            <span className="text-[11px] text-red block font-semibold">Anomaly active</span>
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL INTERPRETATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
          Operational Interpretation
        </h3>
        <div className={`rounded border p-3.5 text-[13px] leading-relaxed ${
          isSurge
            ? "border-red/30 bg-red-tint text-red-dark"
            : "border-teal/30 bg-teal-tint text-teal"
        }`}>
          {isSurge
            ? `${surgeStatus.description || "Unusual influx of emergency arrivals detected exceeding baseline parameters."} Notify nursing supervisor, activate surge overflow bays, and evaluate on-call physician availability.`
            : `Patient arrival velocity is within normal expected operational bounds. No anomaly mitigation required.`}
        </div>
      </div>

      {/* 5. MODEL INFORMATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
              Model & Telemetry Information
            </h3>
            <p className="text-[12px] text-navy-muted">Technical anomaly detection specifications</p>
          </div>
          <ModelBadge model={modelName} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-[12.5px]">
          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Anomaly Engine</span>
            <span className="font-medium text-navy">DBSCAN Density Clustering</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Telemetry Source</span>
            <span className="font-medium text-teal block">Live Velocity Stream Service</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Inference Latency</span>
            <span className="font-mono font-medium text-navy">13.4 ms</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Hyperparameters</span>
            <span className="font-mono text-[11.5px] text-navy-muted">eps: 0.5 | min_samples: 5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
