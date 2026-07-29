import { AlertTriangle, BedDouble, Clock, LayoutGrid, ShieldAlert, TrendingUp, Users } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge, { LEVEL_TONE } from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import {
  CROWDING_RISK_SUMMARY,
  CROWDING_RISK_LEVELS,
  CROWDING_RISK_TIMELINE,
  CROWDING_CONTRIBUTING_FACTORS,
  CROWDING_MODEL,
} from "../mockData";

function CurrentRiskIndicator({ level }) {
  const tone = LEVEL_TONE[level] || "amber";
  const RING_TONE = {
    green: "border-green bg-green-tint text-green",
    amber: "border-amber bg-amber-tint text-amber",
    red: "border-red bg-red-tint text-red",
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className={`flex h-36 w-36 flex-col items-center justify-center rounded-full border-[6px] shadow-soft ${RING_TONE[tone]}`}
      >
        <ShieldAlert className="h-7 w-7" strokeWidth={2.25} aria-hidden="true" />
        <p className="mt-1.5 text-2xl font-bold tracking-tight">{level}</p>
      </div>
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-navy-soft">Current Risk</p>
        <p className="mt-1 font-mono text-[13px] font-semibold text-navy">
          Score: {CROWDING_RISK_SUMMARY.score}/100
        </p>
        <p className="mt-1 text-[12.5px] text-navy-soft">Expected window: {CROWDING_RISK_SUMMARY.window}</p>
      </div>
    </div>
  );
}

function LevelScale({ current }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {CROWDING_RISK_LEVELS.map((lvl) => {
        const isActive = lvl === current;
        const tone = LEVEL_TONE[lvl];
        const TONE_ACTIVE = {
          green: "border-green bg-green-tint text-green",
          amber: "border-amber bg-amber-tint text-amber",
          red: "border-red bg-red-tint text-red",
        };
        return (
          <div
            key={lvl}
            className={`rounded-xl border p-3 text-center transition-colors ${
              isActive ? `${TONE_ACTIVE[tone]} shadow-soft` : "border-border bg-bg text-navy-soft"
            }`}
          >
            <p className={`text-[12.5px] font-semibold ${isActive ? "" : "text-navy-muted"}`}>{lvl}</p>
            {isActive && <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wide">Current</p>}
          </div>
        );
      })}
    </div>
  );
}

function TimelineRow({ time, level, isLast }) {
  const tone = LEVEL_TONE[level] || "amber";
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${isLast ? "" : "border-b border-border"}`}>
      <span className="flex items-center gap-2 text-[13.5px] font-medium text-navy">
        <Clock className="h-3.5 w-3.5 text-navy-soft" strokeWidth={2.25} aria-hidden="true" />
        {time}
      </span>
      <StatusBadge label={level} tone={tone} />
    </div>
  );
}

export default function CrowdingRisk() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Emergency Department Crowding Risk"
        subtitle="Predict overall ED crowding risk using current occupancy, arrivals, and staffing conditions."
        action={<ModelBadge model={CROWDING_MODEL} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Current Risk Level" icon={ShieldAlert} className="flex flex-col items-center">
          <CurrentRiskIndicator level={CROWDING_RISK_SUMMARY.level} />
          <div className="mt-5 w-full">
            <LevelScale current={CROWDING_RISK_SUMMARY.level} />
          </div>
        </ChartCard>

        <ChartCard
          title="Crowding Risk Timeline"
          subtitle="Hour-by-hour risk level through the evening"
          icon={TrendingUp}
          className="lg:col-span-2"
        >
          <div>
            {CROWDING_RISK_TIMELINE.map((row, i) => (
              <TimelineRow
                key={row.time}
                time={row.time}
                level={row.level}
                isLast={i === CROWDING_RISK_TIMELINE.length - 1}
              />
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Contributing Factors"
        subtitle="Current conditions feeding the crowding risk model"
        icon={LayoutGrid}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Occupancy"
            value={`${CROWDING_CONTRIBUTING_FACTORS.occupancy}%`}
            icon={AlertTriangle}
            tone="red"
          />
          <MetricCard
            label="Patients Waiting"
            value={CROWDING_CONTRIBUTING_FACTORS.patientsWaiting}
            icon={Users}
            tone="amber"
          />
          <MetricCard
            label="Expected Arrivals"
            value={CROWDING_CONTRIBUTING_FACTORS.expectedArrivals}
            icon={TrendingUp}
            tone="blue"
          />
          <MetricCard
            label="Available Beds"
            value={CROWDING_CONTRIBUTING_FACTORS.availableBeds}
            icon={BedDouble}
            tone="teal"
          />
          <MetricCard
            label="Predicted Wait"
            value={CROWDING_CONTRIBUTING_FACTORS.predictedWait}
            unit="min"
            icon={Clock}
            tone="navy"
          />
        </div>
      </ChartCard>
    </div>
  );
}
