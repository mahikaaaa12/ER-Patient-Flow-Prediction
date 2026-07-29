import { AlertOctagon, CalendarClock, Info, TrendingUp } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import AnomalyTimeline from "../components/AnomalyTimeline";
import { SURGE_STATUS, SURGE_TIMELINE, RECENT_SURGE_EVENTS, SURGE_DETECTION_MODEL, SURGE_EXPLANATION } from "../mockData";

const SEVERITY_TONE = { High: "red", Moderate: "amber", Low: "green" };

function SurgeEventCard({ when, severity, rate }) {
  const tone = SEVERITY_TONE[severity] || "amber";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-4">
      <div>
        <p className="text-[13.5px] font-semibold text-navy">{when}</p>
        <p className="mt-1 font-mono text-[13px] font-semibold text-navy-muted">{rate}</p>
      </div>
      <StatusBadge label={`${severity} Severity`} tone={tone} />
    </div>
  );
}

export default function SurgeDetection() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patient Surge Detection"
        subtitle="Detect abnormal spikes in patient arrivals by comparing live volume against expected demand."
        action={<ModelBadge model={SURGE_DETECTION_MODEL} />}
      />

      <ChartCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-tint text-red">
              <AlertOctagon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-soft">Current Status</p>
              <div className="mt-1.5">
                <StatusBadge label={SURGE_STATUS.status} tone="red" size="lg" />
              </div>
              <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-navy-muted">
                {SURGE_STATUS.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Normal Arrival Rate"
            value={SURGE_STATUS.normalRateValue}
            unit={SURGE_STATUS.rateUnit}
            tone="navy"
          />
          <MetricCard
            label="Current Arrival Rate"
            value={SURGE_STATUS.currentRateValue}
            unit={SURGE_STATUS.rateUnit}
            tone="red"
          />
          <MetricCard label="Deviation" value={SURGE_STATUS.deviation} tone="red" />
          <MetricCard label="Detected At" value={SURGE_STATUS.detectedAt} tone="navy" />
        </div>
      </ChartCard>

      <ChartCard
        title="Arrival Rate Timeline"
        subtitle="Expected baseline vs. actual arrivals — anomalous periods highlighted"
        icon={TrendingUp}
      >
        <AnomalyTimeline data={SURGE_TIMELINE} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Recent Surge Events"
          subtitle="Anomalies flagged over the last few days"
          icon={CalendarClock}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RECENT_SURGE_EVENTS.map((e) => (
              <SurgeEventCard key={e.id} {...e} />
            ))}
          </div>
        </ChartCard>

        <ChartCard title="How Detection Works" icon={Info}>
          <p className="text-[13.5px] leading-relaxed text-navy-muted">{SURGE_EXPLANATION}</p>
          <p className="mt-4 rounded-xl border border-border bg-bg p-3 text-[12px] leading-relaxed text-navy-soft">
            Note: figures on this page are static mock values for interface demonstration only — they do not
            represent real model predictions.
          </p>
        </ChartCard>
      </div>
    </div>
  );
}
