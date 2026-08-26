import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Layers,
  Percent,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import PageCard from "../components/PageCard";
import SummaryCard from "../components/SummaryCard";
import TrendChart from "../components/TrendChart";
import AlertCard from "../components/AlertCard";
import ModelStatusCard from "../components/ModelStatusCard";
import PatientFlowJourney from "../components/PatientFlowJourney";
import WhatNeedsAttention from "../components/WhatNeedsAttention";
import { erflowApi } from "../../services/api";
import {
  SUMMARY_CARDS as MOCK_SUMMARY_CARDS,
  ARRIVAL_FORECAST_SERIES as MOCK_SERIES,
  FORECAST_CARDS as MOCK_FORECAST_CARDS,
  PREDICTED_PEAK as MOCK_PEAK,
  ALERTS as MOCK_ALERTS,
  FLOW_SUMMARY as MOCK_FLOW,
  AI_SUMMARY_TEXT as MOCK_AI_TEXT,
} from "../mockData";

import { useMode } from "../../context/ModeContext";

const SUMMARY_ICONS = {
  occupancy: Percent,
  waiting: Users,
  "wait-time": Clock,
  velocity: TrendingUp,
  horizon: Users,
  crowding: AlertTriangle,
};

function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning, ER Team";
  if (hour >= 12 && hour < 17) return "Good afternoon, ER Team";
  return "Good evening, ER Team";
}

export default function Overview() {
  const { isRealMode, isDemoMode } = useMode();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await erflowApi.getDashboardOverview();
      setData(res);
    } catch (err) {
      console.warn("ML API overview fetch failed:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isRealMode) {
      loadData();
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isRealMode]);

  const greeting = getTimeBasedGreeting();

  // Mode-aware data resolution
  const summaryCards = isRealMode
    ? data
      ? [
          {
            id: "occupancy",
            label: "Current ER Occupancy",
            value: "78%",
            trend: "+6% vs. baseline",
            trendDirection: "up",
            tone: "blue",
          },
          {
            id: "waiting",
            label: "Patients Waiting",
            value: "24",
            trend: "5 pending triage",
            trendDirection: "up",
            tone: "teal",
          },
          {
            id: "wait-time",
            label: "Expected Wait Time",
            value: `${Math.round(data.waiting_time.waiting_time_minutes)} min`,
            trend: `${data.waiting_time.trend} trend`,
            trendDirection: data.waiting_time.trend === "Increasing" ? "up" : "down",
            tone: "amber",
          },
          {
            id: "velocity",
            label: "Current Arrival Velocity",
            value: `${data.surge_detection.current_arrival_rate || 28} pts/hr`,
            trend: data.surge_detection.deviation_percent || "+33.3%",
            trendDirection: "up",
            tone: "indigo",
          },
          {
            id: "horizon",
            label: "Upcoming Volume (Next 3h)",
            value: `${data.forecast.horizons?.["3h"] || 56} arrivals`,
            trend: "Peak at 7:00 PM",
            trendDirection: "up",
            tone: "purple",
          },
          {
            id: "crowding",
            label: "Current Crowding Level",
            value: data.crowding_risk.crowding_level,
            trend: `Score: ${data.crowding_risk.crowding_score}/100`,
            trendDirection: "up",
            tone:
              data.crowding_risk.crowding_level === "CRITICAL" ||
              data.crowding_risk.crowding_level === "HIGH"
                ? "red"
                : "amber",
          },
        ]
      : null
    : MOCK_SUMMARY_CARDS;

  const forecastSeries = isRealMode ? data?.forecast?.series || null : MOCK_SERIES;
  const forecastCards = isRealMode ? data?.forecast?.forecast_cards || null : MOCK_FORECAST_CARDS;
  const predictedPeak = isRealMode
    ? data
      ? {
          time: data.forecast.predicted_peak_time,
          detail: `Highest expected arrival volume (${data.forecast.predicted_peak_rate} patients/hr)`,
        }
      : null
    : MOCK_PEAK;

  const flowSummary = isRealMode
    ? data
      ? {
          pattern: data.flow_pattern.pattern_name,
          confidence: data.flow_pattern.confidence ? Math.round(data.flow_pattern.confidence) : null,
          surgeStatus: data.surge_detection.status,
        }
      : null
    : MOCK_FLOW;

  const aiSummaryText = isRealMode ? data?.ai_summary_text || null : MOCK_AI_TEXT;

  const alerts = isRealMode
    ? data
      ? [
          {
            id: "a1",
            severity: data.surge_detection.is_surge ? "high" : "info",
            title: data.surge_detection.status,
            detail: `Current arrival rate is ${data.surge_detection.current_arrival_rate || 28} pts/hr (${data.surge_detection.deviation_percent || '+33.3%'} vs normal baseline of ${data.surge_detection.normal_arrival_rate || '13-22'}/hr).`,
          },
          {
            id: "a2",
            severity: data.crowding_risk.crowding_level === "CRITICAL" ? "high" : "warning",
            title: `Department Strain: ${data.crowding_risk.crowding_level} Crowding Level`,
            detail: `Overall crowding index score is ${data.crowding_risk.crowding_score}/100 for window ${data.crowding_risk.expected_window}. Monitor bed availability.`,
          },
          {
            id: "a3",
            severity: "info",
            title: "Peak Demand Period Horizon",
            detail: `Highest patient volume expected around ${data.forecast.predicted_peak_time} (${data.forecast.predicted_peak_rate} pts/hr). Review triage staffing.`,
          },
        ]
      : null
    : MOCK_ALERTS;

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-xl border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic demonstration metrics. Switch to REAL ML MODE in the header for live inference.</span>
          </div>
        </div>
      )}

      {/* Real Mode Error / Unavailable Banner */}
      {isRealMode && error && (
        <div className="flex items-center justify-between rounded-xl border border-red/30 bg-red-tint px-4 py-3 text-[13px] text-red">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-red shrink-0" />
            <span>Prediction Unavailable: Unable to connect to FastAPI backend at http://localhost:8000. Real ML predictions are offline.</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1 font-semibold underline hover:text-red-dark"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* TOP SECTION: Human-Centered Operations Introduction */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-gradient-to-r from-navy/95 to-navy-dark p-6 text-white shadow-lift sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green animate-soft-pulse" />
            <span className="text-[12px] font-semibold tracking-wider text-green-tint uppercase">
              Emergency Department Operations Center
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {greeting}
          </h2>
          <p className="mt-1 text-[14px] text-white/70">
            Here's what's happening in the Emergency Department right now.
          </p>
        </div>

        <div className="mt-4 sm:mt-0">
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur">
            <Activity className="h-4 w-4 text-blue" strokeWidth={2.25} />
            Live ED Operations Status
          </span>
        </div>
      </div>

      {/* KEY OPERATIONAL METRICS */}
      {summaryCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <SummaryCard key={card.id} {...card} icon={SUMMARY_ICONS[card.id] || Activity} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg p-6 text-center text-[13.5px] text-navy-soft font-medium">
          Live operational metrics currently unavailable. Please verify FastAPI backend status.
        </div>
      )}

      {/* VISUAL 5-STAGE PATIENT FLOW JOURNEY */}
      <PatientFlowJourney data={data} />

      {/* WHAT NEEDS ATTENTION (Operational Signals Component) */}
      <WhatNeedsAttention data={data} />

      {/* EXPECTED PATIENT DEMAND (Forecast Chart & Horizons) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PageCard
          title="Expected Patient Demand"
          subtitle="Forecasted patient arrival velocity over the next 24 hours"
          icon={TrendingUp}
          className="xl:col-span-2"
          action={
            <span className="hidden items-center gap-1 text-[11.5px] font-medium text-navy-soft sm:inline-flex">
              <Layers className="h-3.5 w-3.5 text-blue" /> Powered by 2-Layer LSTM Forecast Engine
            </span>
          }
        >
          {forecastSeries ? (
            <TrendChart data={forecastSeries} height={240} tickEvery={3} />
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-bg text-[13px] text-navy-soft font-medium">
              LSTM arrival forecast chart unavailable
            </div>
          )}

          {forecastCards && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {forecastCards.map((f) => (
                <div key={f.id} className="rounded-xl border border-border bg-bg p-3.5 text-center">
                  <p className="font-mono text-2xl font-semibold text-navy">{f.value}</p>
                  <p className="mt-1 text-[11.5px] font-medium text-navy-soft">{f.label}</p>
                </div>
              ))}
            </div>
          )}

          {predictedPeak && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal/25 bg-teal-tint px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-teal">
                <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[13.5px] font-medium text-navy">
                Predicted Peak:{" "}
                <span className="font-semibold text-teal">{predictedPeak.time}</span>
                <span className="hidden text-navy-muted sm:inline"> — {predictedPeak.detail}</span>
              </p>
            </div>
          )}
        </PageCard>

        {/* FLOW SUMMARY & EXECUTIVE AI SUMMARY */}
        <div className="flex flex-col gap-6">
          {flowSummary && (
            <PageCard title="Patient Flow Regime" icon={Activity}>
              <dl className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[13px] font-medium text-navy-soft">Current Flow Regime</dt>
                  <dd className="text-[14px] font-semibold text-navy">{flowSummary.pattern}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[13px] font-medium text-navy-soft">Surge Threat Status</dt>
                  <dd className="inline-flex items-center gap-1.5 rounded-full bg-amber-tint px-2.5 py-1 text-[12.5px] font-semibold text-amber">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                    {flowSummary.surgeStatus}
                  </dd>
                </div>
              </dl>
            </PageCard>
          )}

          <PageCard title="Executive AI Summary" icon={Sparkles}>
            <p className="text-[13.5px] leading-relaxed text-navy-muted">
              {aiSummaryText || "Live AI summary unavailable."}
            </p>
            <Link
              to="/dashboard/ai-assistant"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-soft transition-colors hover:bg-blue-dark"
            >
              <Bot className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              Ask AI Assistant
            </Link>
          </PageCard>
        </div>
      </div>

      {/* TECHNOLOGICAL & MODEL ENGINE HEALTH STATUS (Moved to Bottom as Secondary Metadata) */}
      <div className="mt-2 border-t border-border pt-6">
        <h3 className="mb-3 text-[14px] font-semibold tracking-tight text-navy-soft uppercase">
          Technology & ML Model Status
        </h3>
        <ModelStatusCard />
      </div>
    </div>
  );
}
