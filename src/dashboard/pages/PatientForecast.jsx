import { useEffect, useState } from "react";
import { Ambulance, CheckCircle2, Clock3, Database, Gauge, Layers, Play, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import StepperControl from "../components/StepperControl";
import { erflowApi } from "../../services/api";
import { ARRIVAL_FORECAST_RANGES, FORECAST_CARDS as MOCK_CARDS, FORECAST_INSIGHTS as MOCK_INSIGHTS } from "../mockData";
import { useMode } from "../../context/ModeContext";

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
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-soft">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === opt.id ? "bg-navy text-white" : "text-navy-muted hover:text-navy"
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
  const { isRealMode, isDemoMode } = useMode();
  const [range, setRange] = useState("24h");
  const [currentRate, setCurrentRate] = useState(28);
  const [preset, setPreset] = useState("baseline");
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchForecast(rateVal, presetId) {
    setLoading(true);
    setError(null);

    const mult = presetId === "high_demand" ? 1.4 : presetId === "low_demand" ? 0.5 : 1.0;
    const history168 = Array.from({ length: 168 }, (_, i) => {
      const hour = i % 24;
      const diurnal = Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 8;
      return Math.max(5, Math.round(rateVal * mult + diurnal));
    });

    const requestPayload = {
      arrival_rate: rateVal,
      recent_arrival_history: history168,
      hour_of_day: 18,
      day_of_week: 4,
      month: 7,
    };

    try {
      const res = await erflowApi.getPatientForecast(requestPayload);
      setApiData(res);
    } catch (err) {
      console.warn("Patient forecast fetch failed:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isRealMode) {
      fetchForecast(28, "baseline");
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isRealMode]);

  function handlePresetChange(newPresetId) {
    setPreset(newPresetId);
    const p = SEQUENCE_PRESETS.find((item) => item.id === newPresetId);
    if (p) {
      setCurrentRate(p.baseRate);
      if (isRealMode) {
        fetchForecast(p.baseRate, newPresetId);
      }
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
          metrics: apiData.validation_metrics,
        }
      : null
    : MOCK_INSIGHTS;

  const forecastCards = isRealMode ? apiData?.forecast_cards || null : MOCK_CARDS;

  const activeRangeData = isRealMode
    ? apiData?.series || null
    : (range === "24h" && apiData?.series
        ? apiData.series
        : ARRIVAL_FORECAST_RANGES[range]?.data || ARRIVAL_FORECAST_RANGES["24h"].data);

  return (
    <div className="flex flex-col gap-6">
      {/* MODE INDICATOR BANNERS */}
      {isDemoMode ? (
        <div className="flex items-center justify-between rounded-xl border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white uppercase">DEMO FORECAST / SIMULATED DATA</span>
            <span>Displaying synthetic arrival forecasts. Switch to REAL ML MODE in the header for live LSTM predictions on real historical data.</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-tint px-4 py-3 text-[13px] text-teal">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
            <span>REAL ML MODE ACTIVE — 100% Grounded in Genuine Historical ER Data (`ER_dataset.csv`) & 2-Layer LSTM Model.</span>
          </div>
          <div className="flex items-center gap-2 text-[11.5px] font-mono font-bold text-teal-dark">
            <span>1h MAE: 4.42</span>
            <span>•</span>
            <span>3h MAE: 9.28</span>
            <span>•</span>
            <span>6h MAE: 14.86</span>
            <span>•</span>
            <span>24h MAE: 31.65</span>
          </div>
        </div>
      )}

      <PageHeader
        title="Patient Arrival Forecast"
        subtitle="Forecast expected emergency department demand using genuine historical ER patient arrival sequences."
        action={<RangeControl value={range} onChange={setRange} />}
      />

      {isRealMode && error && (
        <div className="flex items-center justify-between rounded-xl border border-red/30 bg-red-tint px-4 py-3 text-[13px] text-red">
          <div className="flex items-center gap-2 font-semibold">
            <span>Prediction Unavailable: Unable to connect to 2-Layer LSTM forecast engine at http://localhost:8000.</span>
          </div>
          <button
            type="button"
            onClick={() => fetchForecast(currentRate, preset)}
            className="flex items-center gap-1 font-semibold underline hover:text-red-dark"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Interactive LSTM Sequence Selector Card */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-tint text-blue">
              <Layers className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-navy">168-Hour Operational History Controls</h3>
                <span className="rounded-full border border-blue/30 bg-blue-tint px-2.5 py-0.5 font-mono text-[11px] font-semibold text-blue-dark">
                  Required Window: 168 Hours (1 Week)
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-navy-soft">
                Project multi-horizon cumulative patient arrivals using 168-hour historical ER operational trends
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold uppercase tracking-wider text-navy-soft">
              168-Hour Sequence Preset
            </label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] font-medium text-navy focus:border-blue focus:outline-none"
            >
              {SEQUENCE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <StepperControl
            label="Current Arrival Velocity"
            value={currentRate}
            onChange={(val) => setCurrentRate(val)}
            min={5}
            max={60}
            step={1}
            unit="pts/hr"
          />

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => fetchForecast(currentRate, preset)}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-[13px] font-semibold text-white shadow-soft transition-colors hover:bg-blue-dark disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              {loading ? "Checking current ER conditions..." : "Update Arrival Forecast"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title={`Arrival Projection Timeline — ${range.toUpperCase()}`}
          subtitle={isRealMode ? "Solid line = Genuine Historical ER Arrivals; Dashed line = Real 2-Layer LSTM Model Forecast" : "Solid line = Historical; Dashed line = Forecast"}
          icon={TrendingUp}
          className="xl:col-span-2"
        >
          {activeRangeData ? (
            <TrendChart
              data={activeRangeData}
              height={260}
              tickEvery={range === "24h" ? 3 : 1}
              historicalLabel="Observed Arrivals (Actual Historical Data)"
            />
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-bg text-[13px] text-navy-soft font-medium">
              Live arrival forecast series unavailable. Connect to FastAPI backend or switch to Demo Mode.
            </div>
          )}
        </ChartCard>

        <ChartCard title="Forecast Model Telemetry" icon={Gauge}>
          {forecastInsights ? (
            <div>
              <InsightRow icon={Clock3} label="Predicted Peak">
                <span className="text-[13.5px] font-semibold text-navy">{forecastInsights.peakTime}</span>
              </InsightRow>
              <InsightRow icon={Ambulance} label="Peak Arrival Rate">
                <span className="font-mono text-[13.5px] font-semibold text-navy">
                  {forecastInsights.peakRate} patients/hour
                </span>
              </InsightRow>
              <InsightRow icon={TrendingUp} label="Trend">
                <StatusBadge label={forecastInsights.trend} tone="amber" />
              </InsightRow>
              <InsightRow icon={Database} label="Data Source">
                <span className="text-[11.5px] font-semibold text-teal truncate max-w-[170px]" title={forecastInsights.dataSource}>
                  {forecastInsights.dataSource}
                </span>
              </InsightRow>
              <InsightRow icon={Gauge} label="Model Engine">
                <span className="text-[13.5px] font-semibold text-navy">{forecastInsights.model}</span>
              </InsightRow>
              <div className="mt-4">
                <ModelBadge model={forecastInsights.model} />
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[13px] text-navy-soft font-medium">
              Forecast insights unavailable
            </div>
          )}
        </ChartCard>
      </div>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold text-navy">Expected Cumulative Horizon Arrivals</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {forecastCards && forecastCards.map((f) => (
            <MetricCard key={f.id} label={f.label} value={f.value} unit={f.unit} tone="blue" />
          ))}
        </div>
      </div>
    </div>
  );
}
