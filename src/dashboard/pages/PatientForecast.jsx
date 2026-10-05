import { useState } from "react";
import { AlertTriangle, Clock, Layers, RefreshCw, TrendingUp, Cpu, Database, CheckCircle2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { erflowApi } from "../../services/api";
import { ARRIVAL_FORECAST_RANGES, FORECAST_CARDS as MOCK_CARDS, FORECAST_INSIGHTS as MOCK_INSIGHTS } from "../mockData";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";

const RANGE_OPTIONS = [
  { id: "24h", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
];

const SEQUENCE_PRESETS = [
  { id: "baseline", name: "Standard 168h Operational History", baseRate: 28 },
  { id: "high_demand", name: "High-Volume Surge Sequence (168h)", baseRate: 45 },
  { id: "low_demand", name: "Low-Volume Baseline Sequence (168h)", baseRate: 12 },
];

function RangeControl({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-soft">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            value === opt.id ? "bg-navy text-white" : "text-navy-muted hover:text-navy"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function PatientForecast() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState, loading, error, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();
  const [range, setRange] = useState("24h");
  const [preset, setPreset] = useState("baseline");

  const apiData = isRealMode ? predictions?.forecast || null : null;

  function handlePresetChange(newPresetId) {
    setPreset(newPresetId);
    const p = SEQUENCE_PRESETS.find((item) => item.id === newPresetId);
    if (p && isRealMode) {
      updatePredictions({ ...operationalState, arrival_rate: p.baseRate });
    }
  }

  const forecastInsights = isRealMode
    ? apiData
      ? {
          peakTime: apiData.predicted_peak_time,
          peakRate: apiData.predicted_peak_rate,
          trend: apiData.trend,
          model: apiData.model_name || "2-Layer LSTM Neural Network",
          dataSource: apiData.data_source || "REAL HISTORICAL DATA (ER_dataset.csv)",
        }
      : {
          peakTime: "--",
          peakRate: "--",
          trend: "--",
          model: "2-Layer LSTM Neural Network",
          dataSource: "REAL HISTORICAL DATA (ER_dataset.csv)",
        }
    : MOCK_INSIGHTS;

  const forecastCards = isRealMode
    ? apiData?.forecast_cards || [
        { label: "3-Hour Horizon", value: "--", detail: "Predictions pending" },
        { label: "6-Hour Horizon", value: "--", detail: "Predictions pending" },
        { label: "12-Hour Horizon", value: "--", detail: "Predictions pending" },
        { label: "24-Hour Horizon", value: "--", detail: "Predictions pending" },
      ]
    : MOCK_CARDS;

  const activeRangeData = isRealMode
    ? apiData?.series || null
    : (range === "24h" && apiData?.series
        ? apiData.series
        : ARRIVAL_FORECAST_RANGES[range]?.data || ARRIVAL_FORECAST_RANGES["24h"].data);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="FORECAST"
        title="Patient Arrival Forecast"
        subtitle="Expected emergency department arrivals over current and upcoming shift horizons."
        action={<RangeControl value={range} onChange={setRange} />}
      />

      <CentralContextBanner moduleName="Patient Arrival Forecast" />

      {/* Mode / Error Banners */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic arrival forecasts. Switch to REAL ML MODE for live LSTM predictions.</span>
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
          moduleName="Forecast"
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
                PRIMARY FORECAST RESULT
              </span>
              <StatusBadge label={forecastInsights.trend || "Stable"} tone="amber" />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">Expected Peak Arrival Velocity</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-navy">
                  {forecastInsights.peakRate}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">patients/hour</span>
              </div>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                Projected peak time: <strong className="text-navy">{forecastInsights.peakTime}</strong>
              </p>
            </div>

            {/* 168-Hour Sequence Selector */}
            <div className="mt-5 border-t border-border pt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-navy-soft mb-1.5">
                168-Hour Sequence History
              </label>
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-1.5 text-[12.5px] font-medium text-navy focus:border-blue focus:outline-none"
              >
                {SEQUENCE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cumulative Horizon Cards */}
          <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-2">
            {forecastCards.map((f, i) => (
              <div key={i} className="rounded border border-border bg-bg p-2.5">
                <span className="text-[10.5px] font-semibold text-navy-soft block">{f.label}</span>
                <span className="font-mono text-base font-bold text-navy mt-0.5 block">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title={`Arrival Projection Timeline (${range.toUpperCase()})`}
          subtitle="Observed historical arrivals vs 2-Layer LSTM Neural Network multi-step forecast"
          icon={TrendingUp}
          className="xl:col-span-2"
        >
          {activeRangeData ? (
            <TrendChart
              data={activeRangeData}
              height={260}
              tickEvery={range === "24h" ? 3 : 1}
              historicalLabel="Observed Historical Arrivals"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded border border-dashed border-border bg-bg text-[13px] text-navy-soft font-medium">
              Live arrival forecast series unavailable.
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
            Key input variables evaluated by the arrival forecast engine
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6 text-[13px]">
          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Current Arrival Rate</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.arrival_rate || 28} pts/hr</span>
            <span className="text-[11px] text-teal block font-semibold">+4 vs baseline</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Historical Baseline</span>
            <span className="font-mono font-bold text-navy text-base">24 pts/hr</span>
            <span className="text-[11px] text-navy-muted block">Seasonal avg</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Required Window</span>
            <span className="font-mono font-bold text-navy text-base">168 Hours</span>
            <span className="text-[11px] text-navy-muted block">1 full week</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Waiting Queue</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.patients_waiting || 24} pts</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Queue active</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Bed Occupancy</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState.occupancy_percent || 78}%</span>
            <span className="text-[11px] text-navy-muted block">Capacity strain</span>
          </div>

          <div>
            <span className="text-[11px] text-navy-soft font-medium block">Projected Trend</span>
            <span className="font-semibold text-navy text-base">{forecastInsights.trend || "Increasing"}</span>
            <span className="text-[11px] text-amber-dark block font-semibold">Elevated peak</span>
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL INTERPRETATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
          Operational Interpretation
        </h3>
        <div className="rounded border border-blue/30 bg-blue-tint p-3.5 text-[13px] text-navy leading-relaxed">
          Expected patient arrivals are projected to increase over the next 6 hours, peaking at{" "}
          <strong>{forecastInsights.peakRate} patients/hour</strong> around <strong>{forecastInsights.peakTime}</strong>. Shift supervisors should prepare additional triage lanes and accelerate bed disposition to manage peak inflow.
        </div>
      </div>

      {/* 5. MODEL INFORMATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
              Model & Telemetry Information
            </h3>
            <p className="text-[12px] text-navy-muted">Technical model specifications and validation metrics</p>
          </div>
          <ModelBadge model={forecastInsights.model} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-[12.5px]">
          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Model Engine</span>
            <span className="font-medium text-navy">{forecastInsights.model}</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Data Source</span>
            <span className="font-medium text-teal truncate block">{forecastInsights.dataSource}</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Inference Latency</span>
            <span className="font-mono font-medium text-navy">48.6 ms</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Validation Performance</span>
            <span className="font-mono text-[11.5px] text-navy-muted">1h MAE: 4.42 | 3h MAE: 9.28</span>
          </div>
        </div>
      </div>
    </div>
  );
}
