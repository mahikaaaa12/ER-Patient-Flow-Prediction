import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Layers,
  Percent,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import TrendChart from "../components/TrendChart";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import PatientFlowJourney from "../components/PatientFlowJourney";
import EROperationsControlPanel from "../components/EROperationsControlPanel";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";
import { ARRIVAL_FORECAST_SERIES as MOCK_SERIES } from "../mockData";

function getOperationalAlerts(data, operationalState, currentTime) {
  const alerts = [];
  const timeStr = (minsAgo) => {
    const d = new Date(currentTime.getTime() - minsAgo * 60000);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const isSurge = data?.surge_detection?.is_surge;
  const crowding = data?.crowding_risk?.crowding_level;
  const occupancy = operationalState?.occupancy_percent ?? 78;
  const waiting = operationalState?.patients_waiting ?? 24;
  const beds = operationalState?.available_beds ?? 8;
  const arrRate = data?.surge_detection?.current_arrival_rate || operationalState?.arrival_rate || 28;

  if (waiting >= 20) {
    alerts.push({
      time: timeStr(6),
      event: `Waiting queue above expected level (${waiting} patients pending)`,
      severity: "Moderate",
      tone: "amber",
    });
  }

  if (beds <= 5) {
    alerts.push({
      time: timeStr(10),
      event: `Bed availability decreased (${beds} beds remaining)`,
      severity: "High",
      tone: "red",
    });
  }

  if (isSurge || arrRate > 30) {
    alerts.push({
      time: timeStr(17),
      event: `Arrival rate above baseline (${arrRate} pts/hr)`,
      severity: isSurge ? "Critical" : "Moderate",
      tone: isSurge ? "red" : "amber",
    });
  }

  if (crowding === "HIGH" || crowding === "CRITICAL" || occupancy > 85) {
    alerts.push({
      time: timeStr(24),
      event: `Department occupancy elevated (${occupancy}% capacity)`,
      severity: crowding === "CRITICAL" || occupancy > 90 ? "Critical" : "High",
      tone: crowding === "CRITICAL" || occupancy > 90 ? "red" : "amber",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      time: timeStr(2),
      event: "All operational parameters within normal baseline limits",
      severity: "Normal",
      tone: "green",
    });
  }

  return alerts;
}

export default function Overview() {
  const { isRealMode, isDemoMode } = useMode();
  const {
    predictions: data,
    loading,
    error,
    lastUpdated,
    modelStatus,
    hasRunPredictions,
    updatePredictions,
    operationalState,
  } = useERContext();
  const [activeModal, setActiveModal] = useState(null); // 'waiting_time' | 'crowding_risk' | null
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const formattedTimeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formattedFullTimeStr = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const forecastSeries = isRealMode ? data?.forecast?.series || null : MOCK_SERIES;
  const operationalAlerts = getOperationalAlerts(data, operationalState, currentTime);

  // Status indicators for predictions
  const isServicesOnline = !isRealMode || (isRealMode && !error);

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-lg border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white uppercase">
              DEMO MODE / SIMULATED TELEMETRY
            </span>
            <span>Displaying synthetic operational metrics. Switch to REAL ML MODE in the header for live backend model predictions.</span>
          </div>
        </div>
      )}

      {/* Real Mode Operational Status Banner */}
      {isRealMode && (
        <OperationalStatusBanner
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          modelStatus={modelStatus}
          hasRunPredictions={hasRunPredictions}
          onRetry={() => updatePredictions()}
        />
      )}

      {/* 1. PAGE HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            Emergency Department
          </h1>
          <p className="text-[14px] font-semibold text-navy-soft">
            Operational Overview
          </p>
          <p className="mt-1 font-mono text-[12.5px] text-navy-muted">
            {formattedDateStr} · {formattedTimeStr}
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isServicesOnline ? "bg-green" : "bg-red animate-pulse"}`} />
            <span className="text-[13px] font-semibold text-navy">
              {isServicesOnline ? "● Prediction services operational" : "● Prediction service offline"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/ai-assistant"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-dark transition-colors"
            >
              <Bot className="h-3.5 w-3.5" /> Ask ERFlow
            </Link>
            <ModelBadge model="Command Center v2.0" />
          </div>
        </div>
      </div>

      {/* 2. CURRENT OPERATIONS */}
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-navy">
            Current Operations
          </h2>
          <span className="text-[11.5px] font-mono text-navy-soft">
            Live Telemetry Feed
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5 rounded-md overflow-hidden border border-border">
          {/* Occupancy */}
          <div className="bg-bg p-4 flex flex-col justify-between">
            <span className="text-[12px] font-semibold text-navy-soft">Occupancy</span>
            <div className="mt-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-navy">
                {operationalState.occupancy_percent}%
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-navy-muted">
              <span>Unit: % capacity</span>
              <span className="font-medium text-blue">+6% vs base</span>
            </div>
          </div>

          {/* Patients Waiting */}
          <div className="bg-bg p-4 flex flex-col justify-between">
            <span className="text-[12px] font-semibold text-navy-soft">Patients Waiting</span>
            <div className="mt-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-navy">
                {operationalState.patients_waiting}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-navy-muted">
              <span>Unit: Patients</span>
              <span className="font-medium text-teal">Queue active</span>
            </div>
          </div>

          {/* Available Beds */}
          <div className="bg-bg p-4 flex flex-col justify-between">
            <span className="text-[12px] font-semibold text-navy-soft">Available Beds</span>
            <div className="mt-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-navy">
                {operationalState.available_beds}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-navy-muted">
              <span>Unit: Beds</span>
              <span className={operationalState.available_beds <= 4 ? "font-medium text-amber-dark" : "font-medium text-green"}>
                {operationalState.available_beds <= 4 ? "Low capacity" : "Beds ready"}
              </span>
            </div>
          </div>

          {/* Active Physicians */}
          <div className="bg-bg p-4 flex flex-col justify-between">
            <span className="text-[12px] font-semibold text-navy-soft">Active Physicians</span>
            <div className="mt-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-navy">
                {operationalState.available_doctors}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-navy-muted">
              <span>Unit: MD / DO</span>
              <span className="font-medium text-navy-soft">On shift</span>
            </div>
          </div>

          {/* Active Nurses */}
          <div className="bg-bg p-4 flex flex-col justify-between">
            <span className="text-[12px] font-semibold text-navy-soft">Active Nurses</span>
            <div className="mt-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-navy">
                {operationalState.available_nurses}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-navy-muted">
              <span>Unit: RN / BSN</span>
              <span className="font-medium text-navy-soft">On shift</span>
            </div>
          </div>
        </div>
      </div>

      {/* ER OPERATIONS CONTROL PANEL (INPUTS) */}
      <EROperationsControlPanel />

      {/* 3. PATIENT ARRIVAL FORECAST (MAIN VISUAL ELEMENT) */}
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 mb-4">
          <div>
            <h2 className="text-[15px] font-bold text-navy">
              Patient Arrival Forecast
            </h2>
            <p className="text-[12.5px] text-navy-soft">
              Historical arrivals vs. predicted arrivals across horizon (2-Layer LSTM Neural Network)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-mono text-navy-soft">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 bg-navy rounded-xs inline-block" /> Actual History
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 bg-blue border-b border-dashed border-blue inline-block" /> LSTM Forecast
            </span>
            {data?.forecast?.predicted_peak_rate && (
              <span className="rounded-md border border-blue/30 bg-blue-tint px-2 py-0.5 font-bold text-blue-dark">
                Predicted Peak: {data.forecast.predicted_peak_rate} pts/hr @ {data.forecast.predicted_peak_time || "7:00 PM"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2">
          {forecastSeries ? (
            <TrendChart data={forecastSeries} height={280} tickEvery={3} />
          ) : (
            <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-border bg-bg text-[12.5px] font-medium text-navy-soft">
              Patient arrival forecast series unavailable
            </div>
          )}
        </div>
      </div>

      {/* LOWER GRID: RISK SUMMARY, ALERTS, AND PREDICTION SERVICE STATUS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 4. OPERATIONAL RISK SUMMARY */}
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="border-b border-border pb-3 mb-3.5">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-navy">
                Operational Risk Summary
              </h3>
              <p className="text-[11.5px] text-navy-soft">
                Live evaluated strain indicators
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* WAIT TIME */}
              <div
                onClick={() => setActiveModal("waiting_time")}
                className="cursor-pointer rounded-md border border-border bg-bg p-3.5 hover:border-blue/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">Wait Time</span>
                  <StatusBadge
                    label={data?.waiting_time?.trend || "Stable"}
                    tone={data?.waiting_time?.waiting_time_minutes > 40 ? "amber" : "green"}
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-navy">
                    {data ? `${Math.round(data.waiting_time.waiting_time_minutes)} min` : "42 min"}
                  </span>
                  <span className="text-[12px] font-semibold text-navy-muted">
                    {data?.waiting_time?.trend === "Increasing" ? "+8 min expected" : "-4 min expected"}
                  </span>
                </div>
              </div>

              {/* CROWDING */}
              <div
                onClick={() => setActiveModal("crowding_risk")}
                className="cursor-pointer rounded-md border border-border bg-bg p-3.5 hover:border-blue/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">Crowding</span>
                  <StatusBadge
                    label={data?.crowding_risk?.crowding_level || "HIGH"}
                    tone={
                      data?.crowding_risk?.crowding_level === "CRITICAL"
                        ? "red"
                        : data?.crowding_risk?.crowding_level === "HIGH"
                        ? "amber"
                        : "green"
                    }
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-navy">
                    {data?.crowding_risk?.crowding_level || "HIGH"}
                  </span>
                  <span className="font-mono text-[13px] font-bold text-navy-soft">
                    {data?.crowding_risk?.crowding_score ? `${data.crowding_risk.crowding_score} / 100` : "72 / 100"}
                  </span>
                </div>
              </div>

              {/* SURGE */}
              <div className="rounded-md border border-border bg-bg p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">Surge</span>
                  <StatusBadge
                    label={data?.surge_detection?.is_surge ? "ANOMALY" : "NORMAL"}
                    tone={data?.surge_detection?.is_surge ? "red" : "green"}
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-navy">
                    {data?.surge_detection?.is_surge ? "SURGE" : "NORMAL"}
                  </span>
                  <span className="text-[12px] font-semibold text-navy-muted">
                    {data?.surge_detection?.is_surge ? "Anomalous surge detected" : "No anomaly detected"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. OPERATIONAL ALERTS */}
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="border-b border-border pb-3 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-navy">
                  Operational Alerts
                </h3>
                <p className="text-[11.5px] text-navy-soft">
                  Real-time threshold events
                </p>
              </div>
              <span className="rounded bg-bg border border-border px-2 py-0.5 text-[11px] font-mono text-navy-soft">
                Live Stream
              </span>
            </div>

            <div className="flex flex-col divide-y divide-border">
              {operationalAlerts.map((alert, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-navy-muted block">
                      {alert.time}
                    </span>
                    <p className="text-[12.5px] font-semibold text-navy mt-0.5 leading-snug">
                      {alert.event}
                    </p>
                  </div>
                  <StatusBadge label={alert.severity} tone={alert.tone} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6. PREDICTION SERVICE STATUS */}
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-soft flex flex-col justify-between">
          <div>
            <div className="border-b border-border pb-3 mb-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-wider text-navy">
                  Prediction Services
                </h3>
                <p className="text-[11.5px] text-navy-soft">
                  Engine Status Monitor
                </p>
              </div>
              <span className={`text-[11px] font-mono font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                {isServicesOnline ? "100% Operational" : "Degraded"}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-border text-[12.5px]">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-navy">Forecast</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                  <span className={`h-2 w-2 rounded-full ${isServicesOnline ? "bg-teal" : "bg-red"}`} />
                  {isServicesOnline ? "Operational" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-navy">Wait Time</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                  <span className={`h-2 w-2 rounded-full ${isServicesOnline ? "bg-teal" : "bg-red"}`} />
                  {isServicesOnline ? "Operational" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-navy">Crowding</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                  <span className={`h-2 w-2 rounded-full ${isServicesOnline ? "bg-teal" : "bg-red"}`} />
                  {isServicesOnline ? "Operational" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-navy">Flow Patterns</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                  <span className={`h-2 w-2 rounded-full ${isServicesOnline ? "bg-teal" : "bg-red"}`} />
                  {isServicesOnline ? "Operational" : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-navy">Surge</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${isServicesOnline ? "text-teal" : "text-red"}`}>
                  <span className={`h-2 w-2 rounded-full ${isServicesOnline ? "bg-teal" : "bg-red"}`} />
                  {isServicesOnline ? "Operational" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-3 text-right font-mono text-[11px] text-navy-muted">
            Last updated: {formattedFullTimeStr}
          </div>
        </div>
      </div>

      {/* PATIENT FLOW PIPELINE */}
      <PatientFlowJourney data={data} />

      {/* EXPLAINABILITY MODAL (TreeSHAP Feature Attributions) */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lift">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4.5 w-4.5 text-blue" />
                <h3 className="text-[15px] font-semibold text-navy">
                  {activeModal === "waiting_time" ? "Waiting-Time Model Attribution" : "Crowding Risk Model Attribution"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-md p-1 text-navy-soft hover:bg-bg hover:text-navy"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[12px] text-navy-soft mb-3">
              TreeSHAP feature attributions explaining model output contribution factors:
            </p>

            <div className="flex flex-col gap-2">
              {(activeModal === "waiting_time"
                ? data?.waiting_time?.explanation?.top_contributing_features || [
                    { feature: "Patients Waiting", contribution: 18.4, direction: "increases_wait" },
                    { feature: "Arrival Rate", contribution: 12.1, direction: "increases_wait" },
                    { feature: "Occupancy Percent", contribution: 8.5, direction: "increases_wait" },
                    { feature: "Staff Total", contribution: -4.2, direction: "decreases_wait" },
                  ]
                : data?.crowding_risk?.explanation?.top_contributing_features || [
                    { feature: "Occupancy Percent", contribution: 24.1, direction: "increases_risk" },
                    { feature: "Patients Waiting", contribution: 19.3, direction: "increases_risk" },
                    { feature: "Arrival Rate", contribution: 14.0, direction: "increases_risk" },
                  ]
              ).map((feat, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-[12.5px]">
                  <span className="font-semibold text-navy">{feat.feature}</span>
                  <span className={`font-mono font-bold ${feat.contribution >= 0 ? "text-amber-dark" : "text-teal"}`}>
                    {feat.contribution >= 0 ? `+${feat.contribution}` : feat.contribution}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-md bg-navy px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-navy-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
