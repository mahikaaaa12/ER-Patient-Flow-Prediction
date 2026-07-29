import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Clock,
  Percent,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import PageCard from "../components/PageCard";
import SummaryCard from "../components/SummaryCard";
import TrendChart from "../components/TrendChart";
import AlertCard from "../components/AlertCard";
import {
  SUMMARY_CARDS,
  ARRIVAL_FORECAST_SERIES,
  FORECAST_CARDS,
  PREDICTED_PEAK,
  ALERTS,
  FLOW_SUMMARY,
  AI_SUMMARY_TEXT,
} from "../mockData";

const SUMMARY_ICONS = {
  occupancy: Percent,
  waiting: Users,
  "wait-time": Clock,
  crowding: AlertTriangle,
};

export default function Overview() {
  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <SummaryCard key={card.id} {...card} icon={SUMMARY_ICONS[card.id]} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Forecast chart */}
        <PageCard
          title="Patient Arrival Forecast"
          subtitle="Historical vs. forecasted arrivals over the next 24 hours"
          icon={TrendingUp}
          className="xl:col-span-2"
        >
          <TrendChart data={ARRIVAL_FORECAST_SERIES} height={240} tickEvery={3} />

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FORECAST_CARDS.map((f) => (
              <div key={f.id} className="rounded-xl border border-border bg-bg p-3.5 text-center">
                <p className="font-mono text-2xl font-semibold text-navy">{f.value}</p>
                <p className="mt-1 text-[11.5px] font-medium text-navy-soft">{f.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-teal/25 bg-teal-tint px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-teal">
              <Activity className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="text-[13.5px] font-medium text-navy">
              Predicted Peak:{" "}
              <span className="font-semibold text-teal">{PREDICTED_PEAK.time}</span>
              <span className="hidden text-navy-muted sm:inline"> — {PREDICTED_PEAK.detail}</span>
            </p>
          </div>
        </PageCard>

        {/* Flow summary + AI summary stacked */}
        <div className="flex flex-col gap-6">
          <PageCard title="Patient Flow Summary" icon={Activity}>
            <dl className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[13px] font-medium text-navy-soft">Current Pattern</dt>
                <dd className="text-[14px] font-semibold text-navy">{FLOW_SUMMARY.pattern}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[13px] font-medium text-navy-soft">Pattern Confidence</dt>
                <dd className="font-mono text-[14px] font-semibold text-navy">
                  {FLOW_SUMMARY.confidence}%
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[13px] font-medium text-navy-soft">Surge Status</dt>
                <dd className="inline-flex items-center gap-1.5 rounded-full bg-amber-tint px-2.5 py-1 text-[12.5px] font-semibold text-amber">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                  {FLOW_SUMMARY.surgeStatus}
                </dd>
              </div>
            </dl>
          </PageCard>

          <PageCard title="AI Summary" icon={Sparkles} className="flex-1">
            <p className="text-[13.5px] leading-relaxed text-navy-muted">{AI_SUMMARY_TEXT}</p>
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

      {/* Operational alerts */}
      <PageCard title="Operational Alerts" subtitle="Active alerts generated from current forecasts" icon={AlertTriangle}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {ALERTS.map((a) => (
            <AlertCard key={a.id} severity={a.severity} title={a.title} detail={a.detail} />
          ))}
        </div>
      </PageCard>
    </div>
  );
}
