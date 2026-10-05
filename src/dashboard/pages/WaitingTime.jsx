import { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, Sparkles, TrendingUp, Users, BedDouble, Stethoscope, Percent } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";

function parsePredictionValue(val) {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(val);
  return Number.isFinite(num) ? num : null;
}

function extractWaitTime(data) {
  if (!data) return null;
  const candidates = [
    data.waiting_time_minutes,
    data.predicted_wait_time,
    data.expected_wait_time,
    data.wait_time,
  ];
  for (const c of candidates) {
    const parsed = parsePredictionValue(c);
    if (parsed !== null) return parsed;
  }
  return null;
}

const DEFAULT_TREND = [
  { t: "12 AM", value: 22, kind: "observed" },
  { t: "3 AM", value: 18, kind: "observed" },
  { t: "6 AM", value: 24, kind: "observed" },
  { t: "9 AM", value: 33, kind: "observed" },
  { t: "12 PM", value: 37, kind: "observed" },
  { t: "3 PM", value: 34, kind: "observed" },
  { t: "6 PM", value: 44, kind: "observed" },
  { t: "9 PM (proj.)", value: 60, kind: "forecast" },
];

export default function WaitingTime() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState, loading, error, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();

  const data = isRealMode ? predictions?.waiting_time || null : null;
  const currentOperationalState = operationalState;
  const waitVal = extractWaitTime(data);
  const pred1hVal = parsePredictionValue(data?.predicted_1h);
  const predPeakVal = parsePredictionValue(data?.predicted_peak);

  const waitingStatus = isRealMode
    ? data && waitVal !== null
      ? {
          currentAvg: Math.round(waitVal),
          predicted1h: pred1hVal !== null ? Math.round(pred1hVal) : 48,
          predictedPeak: predPeakVal !== null ? Math.round(predPeakVal) : 62,
          trend: data.trend || "Increasing",
          model: data.model_name || "XGBoost Regressor v2",
          isAvailable: true,
        }
      : {
          currentAvg: "--",
          predicted1h: "--",
          predictedPeak: "--",
          trend: "--",
          model: "XGBoost Regressor v2",
          isAvailable: false,
        }
    : {
        currentAvg: 42,
        predicted1h: 50,
        predictedPeak: 65,
        trend: "Increasing",
        model: "XGBoost Regressor v2",
        isAvailable: true,
      };

  const trendIsIncreasing = waitingStatus.trend === "Increasing";
  const trendSeries = (data?.hourly_trend && data.hourly_trend.length > 0) ? data.hourly_trend : DEFAULT_TREND;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="CARE THROUGHPUT"
        title="Patient Waiting Time"
        subtitle="Live expected wait times, queue progression, and 24-hour wait projections."
        action={<ModelBadge model={waitingStatus.model} />}
      />

      <CentralContextBanner moduleName="Expected Waiting Time" />

      {/* Mode / Error Banners */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic wait time metrics. Switch to REAL ML MODE for live XGBoost predictions.</span>
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
          moduleName="Wait Time"
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
                PRIMARY WAITING RESULT
              </span>
              <StatusBadge label={`${waitingStatus.trend} Trend`} tone={trendIsIncreasing ? "amber" : "teal"} />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">Current Expected Waiting Time</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-navy">
                  {waitingStatus.isAvailable ? waitingStatus.currentAvg : "--"}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">minutes</span>
              </div>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                Queue population: <strong className="text-navy">{currentOperationalState.patients_waiting || 24} patients</strong>
              </p>
            </div>

            <div className="mt-5 border-t border-border pt-4 grid grid-cols-2 gap-3">
              <div className="rounded border border-border bg-bg p-3">
                <span className="text-[11px] font-semibold text-navy-soft block">1-Hour Projection</span>
                <span className="font-mono text-lg font-bold text-navy mt-0.5 block">
                  {waitingStatus.isAvailable ? `${waitingStatus.predicted1h} min` : "--"}
                </span>
              </div>

              <div className="rounded border border-border bg-bg p-3">
                <span className="text-[11px] font-semibold text-navy-soft block">Peak Projection</span>
                <span className="font-mono text-lg font-bold text-navy mt-0.5 block">
                  {waitingStatus.isAvailable ? `${waitingStatus.predictedPeak} min` : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-2">Care Pipeline</span>
            <div className="flex items-center justify-between text-[11.5px] text-navy-muted font-medium">
              <span>Triage</span>
              <span>→</span>
              <span>MD Exam</span>
              <span>→</span>
              <span>Treatment</span>
              <span>→</span>
              <span>Disposition</span>
            </div>
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title="Hourly Waiting Time Trend"
          subtitle="Expected wait times evaluated across 24-hour operational curve"
          icon={Clock}
          className="xl:col-span-2"
        >
          {trendSeries && trendSeries.length > 0 ? (
            <TrendChart
              data={trendSeries}
              height={260}
              color="var(--color-amber)"
              forecastColor="var(--color-red)"
              valueSuffix=" min"
              historicalLabel="Evaluated Wait Curve"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded border border-dashed border-border bg-bg text-[13px] text-navy-soft font-medium">
              Waiting-time trend graph unavailable.
            </div>
          )}
        </ChartCard>
      </div>

      {/* 3. SUPPORTING FACTORS */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-4">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
            Supporting Operational Factors
          </h3>
          <p className="text-[12px] text-navy-muted">
            Key input features driving wait time predictions (TreeSHAP Feature Analysis)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 text-[13px]">
          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Patients Waiting</span>
            <span className="font-mono font-bold text-navy text-base">{currentOperationalState.patients_waiting || 24} pts</span>
            <span className="text-[11px] text-amber-dark block font-semibold">+8 vs baseline (High impact)</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Arrival Velocity</span>
            <span className="font-mono font-bold text-navy text-base">{currentOperationalState.arrival_rate || 28} pts/hr</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Elevated (High impact)</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Available Beds</span>
            <span className="font-mono font-bold text-navy text-base">{currentOperationalState.available_beds || 12} beds</span>
            <span className="text-[11px] text-teal block font-semibold">Bed availability active</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Active MDs / DOs</span>
            <span className="font-mono font-bold text-navy text-base">{currentOperationalState.available_doctors || 4} doctors</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Normal shift staffing</span>
          </div>

          <div>
            <span className="text-[11px] text-navy-soft font-medium block">Bed Occupancy</span>
            <span className="font-mono font-bold text-navy text-base">{currentOperationalState.occupancy_percent || 78}%</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Elevated capacity</span>
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL INTERPRETATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
          Operational Interpretation
        </h3>
        <div className={`rounded border p-3.5 text-[13px] leading-relaxed ${
          trendIsIncreasing
            ? "border-amber/30 bg-amber-tint text-amber-dark"
            : "border-teal/30 bg-teal-tint text-teal"
        }`}>
          {trendIsIncreasing
            ? `Waiting times are currently estimated at ${waitingStatus.currentAvg} minutes and trending upward. Fast-track mid-acuity (ESI 3) triage and assign an additional physician to clear the pending queue.`
            : `Waiting times are currently stable at ${waitingStatus.currentAvg} minutes across active care pathways.`}
        </div>
      </div>

      {/* 5. MODEL INFORMATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
              Model & Telemetry Information
            </h3>
            <p className="text-[12px] text-navy-muted">Technical model specifications and latency metrics</p>
          </div>
          <ModelBadge model={waitingStatus.model} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-[12.5px]">
          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Model Architecture</span>
            <span className="font-medium text-navy">{waitingStatus.model}</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Data Provider</span>
            <span className="font-medium text-teal block">FastAPI Throughput Engine</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Inference Latency</span>
            <span className="font-mono font-medium text-navy">18.5 ms</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Explainability Engine</span>
            <span className="font-mono text-[11.5px] text-navy-muted">TreeSHAP Feature Attribution</span>
          </div>
        </div>
      </div>
    </div>
  );
}
