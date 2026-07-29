import { Activity, PieChart, ScatterChart } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import ClusterScatter from "../components/ClusterScatter";
import BarList from "../components/BarList";
import {
  CURRENT_PATTERN,
  FLOW_PATTERN_CARDS,
  FLOW_PATTERN_DISTRIBUTION,
  FLOW_CLUSTERS,
  FLOW_CLUSTER_POINTS,
  FLOW_CURRENT_POINT,
  FLOW_ANALYSIS_MODEL,
} from "../mockData";

const DOT_TONE = {
  green: "bg-green",
  amber: "bg-amber",
  blue: "bg-blue",
  red: "bg-red",
  teal: "bg-teal",
  navy: "bg-navy",
};

function PatternCard({ name, tone, characteristics, active }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-soft ${
        active ? "border-blue/30 bg-blue-tint" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[14.5px] font-semibold ${active ? "text-blue-dark" : "text-navy"}`}>{name}</p>
        {active && <StatusBadge label="ACTIVE" tone="blue" />}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {characteristics.map((c) => (
          <li key={c} className="flex items-start gap-2 text-[13px] leading-relaxed text-navy-muted">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone] || DOT_TONE.navy}`} />
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FlowPatterns() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patient Flow Pattern Discovery"
        subtitle="Explore recurring emergency department demand patterns identified from historical data."
        action={<ModelBadge model={FLOW_ANALYSIS_MODEL} />}
      />

      <ChartCard title="Current Detected Pattern" icon={Activity}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[20px] font-semibold text-navy">{CURRENT_PATTERN.name}</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-navy-muted">
              {CURRENT_PATTERN.description}
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-border bg-bg px-5 py-4 text-center">
            <p className="font-mono text-3xl font-semibold text-navy">{CURRENT_PATTERN.confidence}%</p>
            <p className="mt-1 text-[11.5px] font-medium uppercase tracking-wide text-navy-soft">Confidence</p>
          </div>
        </div>
      </ChartCard>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold text-navy">Detected Patterns</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FLOW_PATTERN_CARDS.map((p) => (
            <PatternCard key={p.id} {...p} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Patient-Flow Clusters"
          subtitle="Illustrative grouping of ER states by arrival volume and system strain"
          icon={ScatterChart}
          className="xl:col-span-2"
        >
          <ClusterScatter
            clusters={FLOW_CLUSTERS}
            points={FLOW_CLUSTER_POINTS}
            currentPoint={FLOW_CURRENT_POINT}
          />
        </ChartCard>

        <ChartCard
          title="Pattern Distribution"
          subtitle="How frequently each pattern occurs"
          icon={PieChart}
        >
          <BarList
            items={FLOW_PATTERN_DISTRIBUTION.map((p) => ({
              label: p.label,
              value: p.value,
              max: 100,
              tone: p.tone,
              valueLabel: `${p.value}%`,
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}
