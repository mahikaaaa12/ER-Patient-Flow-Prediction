import { useState } from "react";
import { Ambulance, Clock3, Gauge, TrendingUp } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import { ARRIVAL_FORECAST_RANGES, FORECAST_CARDS, FORECAST_INSIGHTS } from "../mockData";

const RANGE_OPTIONS = [
  { id: "24h", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
];

function RangeControl({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-soft">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === opt.id ? "bg-blue text-white shadow-soft" : "text-navy-soft hover:bg-bg hover:text-navy"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InsightRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex items-center gap-2 text-[13px] font-medium text-navy-soft">
        <Icon className="h-4 w-4 text-navy-soft" strokeWidth={2.25} aria-hidden="true" />
        {label}
      </span>
      {children}
    </div>
  );
}

export default function PatientForecast() {
  const [range, setRange] = useState("24h");
  const activeRange = ARRIVAL_FORECAST_RANGES[range];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patient Arrival Forecast"
        subtitle="Forecast expected emergency department demand using historical patient arrival patterns."
        action={<RangeControl value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title={`Arrival Forecast — ${activeRange.label}`}
          subtitle="Solid line reflects historical data; dashed line reflects the forecast"
          icon={TrendingUp}
          className="xl:col-span-2"
        >
          <TrendChart
            data={activeRange.data}
            height={260}
            tickEvery={range === "24h" ? 3 : 1}
            historicalLabel="Historical Data"
          />
        </ChartCard>

        <ChartCard title="Forecast Insights" icon={Gauge}>
          <div>
            <InsightRow icon={Clock3} label="Predicted Peak">
              <span className="text-[13.5px] font-semibold text-navy">{FORECAST_INSIGHTS.peakTime}</span>
            </InsightRow>
            <InsightRow icon={Ambulance} label="Peak Arrival Rate">
              <span className="font-mono text-[13.5px] font-semibold text-navy">
                {FORECAST_INSIGHTS.peakRate} patients/hour
              </span>
            </InsightRow>
            <InsightRow icon={TrendingUp} label="Trend">
              <StatusBadge label={FORECAST_INSIGHTS.trend} tone="amber" />
            </InsightRow>
            <InsightRow icon={Gauge} label="Model">
              <span className="text-[13.5px] font-semibold text-navy">{FORECAST_INSIGHTS.model}</span>
            </InsightRow>
          </div>
          <div className="mt-4">
            <ModelBadge model={FORECAST_INSIGHTS.model} />
          </div>
        </ChartCard>
      </div>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold text-navy">Expected Arrivals</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {FORECAST_CARDS.map((f) => (
            <MetricCard key={f.id} label={f.label} value={f.value} unit={f.unit} tone="blue" />
          ))}
        </div>
      </div>
    </div>
  );
}
