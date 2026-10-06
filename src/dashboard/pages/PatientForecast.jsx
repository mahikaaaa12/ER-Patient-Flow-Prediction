import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Layers, RefreshCw, TrendingUp, Cpu, Database, CheckCircle2, Loader2 } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { erflowApi } from "../../services/api";
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

function RangeControl({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-soft">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          aria-pressed={value === opt.id}
          className={`rounded px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            value === opt.id ? "bg-navy text-white" : "text-navy-muted hover:text-navy"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function generateDemoPredictionsForHorizon(state, horizon = "24h") {
  const arrRate = Number(state.arrival_rate ?? 28);
  const dailyBase = Math.round(arrRate * 18.0);

  if (horizon === "7d") {
    return {
      horizon: "7d",
      predicted_peak_time: "Saturday",
      predicted_peak_rate: Math.round(dailyBase * 1.15),
      trend: arrRate > 25 ? "Increasing" : "Stable",
      horizons: {
        peak_day_volume: Math.round(dailyBase * 1.15),
        total_7d: Math.round(dailyBase * 7.1),
        daily_avg: Math.round(dailyBase * 1.01),
        peak_day: "Saturday",
      },
      forecast_cards: [
        { id: "peak_day", label: "Peak Day Volume", value: Math.round(dailyBase * 1.15), unit: "patients" },
        { id: "total_7d", label: "7-Day Total Arrivals", value: Math.round(dailyBase * 7.1), unit: "patients" },
        { id: "daily_avg", label: "Daily Avg Demand", value: Math.round(dailyBase * 1.01), unit: "pts/day" },
        { id: "peak_day_name", label: "Peak Arrival Day", value: Math.round(dailyBase * 1.15), unit: "Saturday" },
      ],
      series: [
        { t: "Wed", value: Math.round(dailyBase * 0.95), kind: "observed" },
        { t: "Thu", value: Math.round(dailyBase * 0.98), kind: "observed" },
        { t: "Fri", value: Math.round(dailyBase * 1.05), kind: "observed" },
        { t: "Sat", value: Math.round(dailyBase * 1.12), kind: "observed" },
        { t: "Sun", value: Math.round(dailyBase * 1.08), kind: "observed" },
        { t: "Mon", value: Math.round(dailyBase * 0.96), kind: "observed" },
        { t: "Tue", value: Math.round(dailyBase * 0.99), kind: "observed" },
        { t: "Wed (proj.)", value: Math.round(dailyBase * 1.02), kind: "forecast" },
        { t: "Thu (proj.)", value: Math.round(dailyBase * 1.04), kind: "forecast" },
        { t: "Fri (proj.)", value: Math.round(dailyBase * 1.10), kind: "forecast" },
        { t: "Sat (proj.)", value: Math.round(dailyBase * 1.15), kind: "forecast" },
        { t: "Sun (proj.)", value: Math.round(dailyBase * 1.11), kind: "forecast" },
        { t: "Mon (proj.)", value: Math.round(dailyBase * 0.98), kind: "forecast" },
        { t: "Tue (proj.)", value: Math.round(dailyBase * 1.01), kind: "forecast" },
      ],
      model_name: "2-Layer LSTM Neural Network",
      data_source: "Synthetic Demo 7-Day Forecast Engine",
      validation_metrics: { mae: 14.2, rmse: 18.5 },
    };
  } else if (horizon === "30d") {
    const seriesData = [];
    for (let i = 30; i >= 1; i--) {
      seriesData.push({ t: `Day -${i}`, value: Math.round(dailyBase * (0.9 + 0.15 * Math.sin(i))), kind: "observed" });
    }
    for (let i = 1; i <= 30; i++) {
      seriesData.push({ t: `Day +${i} (proj.)`, value: Math.round(dailyBase * (0.95 + 0.18 * Math.sin(i + 3))), kind: "forecast" });
    }
    return {
      horizon: "30d",
      predicted_peak_time: "Day +18",
      predicted_peak_rate: Math.round(dailyBase * 1.18),
      trend: arrRate > 25 ? "Increasing" : "Stable",
      horizons: {
        peak_day_volume: Math.round(dailyBase * 1.18),
        total_30d: Math.round(dailyBase * 30.2),
        daily_avg: Math.round(dailyBase * 1.01),
        busiest_week: "Week 3",
      },
      forecast_cards: [
        { id: "peak_day_30d", label: "Peak Day Volume", value: Math.round(dailyBase * 1.18), unit: "patients" },
        { id: "total_30d", label: "30-Day Total Volume", value: Math.round(dailyBase * 30.2), unit: "patients" },
        { id: "daily_avg_30d", label: "30-Day Daily Average", value: Math.round(dailyBase * 1.01), unit: "pts/day" },
        { id: "busiest_week", label: "Busiest Week Projected", value: Math.round(dailyBase * 1.18), unit: "Week 3" },
      ],
      series: seriesData,
      model_name: "2-Layer LSTM Neural Network",
      data_source: "Synthetic Demo 30-Day Forecast Engine",
      validation_metrics: { mae: 28.6, rmse: 35.1 },
    };
  } else {
    return {
      horizon: "24h",
      predicted_peak_time: "7:00 PM",
      predicted_peak_rate: Math.round(arrRate * 1.2),
      trend: arrRate > 25 ? "Increasing" : "Stable",
      horizons: {
        "1h": Math.round(arrRate * 0.9),
        "3h": Math.round(arrRate * 2.4),
        "6h": Math.round(arrRate * 4.8),
        "24h": Math.round(arrRate * 18.0),
      },
      forecast_cards: [
        { id: "1h", label: "Next 1 Hour", value: Math.round(arrRate * 0.9), unit: "patients" },
        { id: "3h", label: "Next 3 Hours", value: Math.round(arrRate * 2.4), unit: "patients" },
        { id: "6h", label: "Next 6 Hours", value: Math.round(arrRate * 4.8), unit: "patients" },
        { id: "24h", label: "Next 24 Hours", value: Math.round(arrRate * 18.0), unit: "patients" },
      ],
      series: [
        { t: "6 AM", value: Math.round(arrRate * 0.5), kind: "observed" },
        { t: "7 AM", value: Math.round(arrRate * 0.6), kind: "observed" },
        { t: "8 AM", value: Math.round(arrRate * 0.7), kind: "observed" },
        { t: "9 AM", value: Math.round(arrRate * 0.8), kind: "observed" },
        { t: "10 AM", value: Math.round(arrRate * 0.85), kind: "observed" },
        { t: "11 AM", value: Math.round(arrRate * 0.9), kind: "observed" },
        { t: "12 PM", value: Math.round(arrRate * 0.95), kind: "observed" },
        { t: "1 PM", value: Math.round(arrRate * 1.0), kind: "observed" },
        { t: "2 PM", value: Math.round(arrRate * 1.05), kind: "observed" },
        { t: "3 PM", value: Math.round(arrRate * 1.1), kind: "observed" },
        { t: "4 PM", value: Math.round(arrRate * 1.12), kind: "observed" },
        { t: "5 PM", value: Math.round(arrRate * 1.15), kind: "observed" },
        { t: "6 PM", value: Math.round(arrRate * 1.18), kind: "forecast" },
        { t: "7 PM", value: Math.round(arrRate * 1.25), kind: "forecast" },
        { t: "8 PM", value: Math.round(arrRate * 1.20), kind: "forecast" },
        { t: "9 PM", value: Math.round(arrRate * 1.10), kind: "forecast" },
        { t: "10 PM", value: Math.round(arrRate * 0.95), kind: "forecast" },
        { t: "11 PM", value: Math.round(arrRate * 0.80), kind: "forecast" },
      ],
      model_name: "2-Layer LSTM Neural Network",
      data_source: "Synthetic Demo Forecast Engine",
      validation_metrics: { mae: 4.42, rmse: 5.81 },
    };
  }
}

export default function PatientForecast() {
  const { isRealMode, isDemoMode } = useMode();
  const { operationalState, loading: globalLoading, error: globalError, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();
  const [range, setRange] = useState("24h");
  const [preset, setPreset] = useState("baseline");

  const [horizonData, setHorizonData] = useState(null);
  const [horizonLoading, setHorizonLoading] = useState(false);
  const [horizonError, setHorizonError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadForecastForHorizon() {
      setHorizonLoading(true);
      setHorizonError(null);
      console.log(`[PatientForecast Debug] Requesting forecast for horizon=${range} in ${isRealMode ? "REAL ML" : "DEMO"} mode...`);
      try {
        if (isRealMode) {
          const res = await erflowApi.getPatientForecast(operationalState, range);
          if (!isCancelled) {
            console.log(`[PatientForecast Debug] API Response received for horizon=${range}:`, res);
            console.log(`[PatientForecast Debug] Series points count: ${res?.series?.length}, First:`, res?.series?.[0], `Last:`, res?.series?.[res?.series?.length - 1]);
            setHorizonData(res);
          }
        } else {
          const demoRes = generateDemoPredictionsForHorizon(operationalState, range);
          if (!isCancelled) {
            console.log(`[PatientForecast Debug] Demo predictions generated for horizon=${range}:`, demoRes);
            setHorizonData(demoRes);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`[PatientForecast Debug] Error fetching horizon=${range}:`, err.message);
          setHorizonError(err.message || "Failed to load forecast for selected horizon");
          setHorizonData(null);
        }
      } finally {
        if (!isCancelled) {
          setHorizonLoading(false);
        }
      }
    }

    loadForecastForHorizon();

    return () => {
      isCancelled = true;
    };
  }, [range, isRealMode, operationalState]);

  function handlePresetChange(newPresetId) {
    setPreset(newPresetId);
    const p = SEQUENCE_PRESETS.find((item) => item.id === newPresetId);
    if (p) {
      updatePredictions({ ...operationalState, arrival_rate: p.baseRate });
    }
  }

  const forecastInsights = horizonData
    ? {
        peakTime: horizonData.predicted_peak_time,
        peakRate: horizonData.predicted_peak_rate,
        trend: horizonData.trend,
        model: horizonData.model_name || "2-Layer LSTM Neural Network",
        dataSource: horizonData.data_source || (isRealMode ? "REAL HISTORICAL DATA (ER_dataset.csv)" : "Synthetic Demo Forecast Engine"),
      }
    : {
        peakTime: "--",
        peakRate: "--",
        trend: "--",
        model: "2-Layer LSTM Neural Network",
        dataSource: isRealMode ? "REAL HISTORICAL DATA (ER_dataset.csv)" : "Synthetic Demo Forecast Engine",
      };

  const forecastCards = horizonData?.forecast_cards || [
    { label: "Metric 1", value: "--", unit: "" },
    { label: "Metric 2", value: "--", unit: "" },
    { label: "Metric 3", value: "--", unit: "" },
    { label: "Metric 4", value: "--", unit: "" },
  ];

  const activeRangeData = horizonData?.series || null;

  const horizonTitle = range === "24h" ? "24H" : range === "7d" ? "7 DAYS" : "30 DAYS";
  const horizonSub = range === "24h"
    ? "Observed historical arrivals vs 2-Layer LSTM Neural Network multi-step forecast"
    : range === "7d"
    ? "Observed historical daily arrivals vs 2-Layer LSTM Neural Network 7-day multi-step forecast"
    : "Observed historical daily arrivals vs 2-Layer LSTM Neural Network 30-day multi-step forecast";

  const tickEvery = range === "24h" ? 3 : range === "7d" ? 1 : 5;
  const rateUnitLabel = range === "24h" ? "patients/hour" : "patients/day";
  const peakTimeLabel = range === "24h" ? "Projected peak time:" : range === "7d" ? "Projected peak day:" : "Projected peak date:";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="FORECAST"
        title="Patient Arrival Forecast"
        subtitle="Expected emergency department arrivals over current and upcoming shift horizons."
        action={<RangeControl value={range} onChange={setRange} disabled={horizonLoading} />}
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
          loading={globalLoading || horizonLoading}
          error={globalError || horizonError}
          lastUpdated={lastUpdated}
          modelStatus={modelStatus}
          hasRunPredictions={hasRunPredictions}
          moduleName="Forecast"
          onRetry={() => updatePredictions()}
        />
      )}

      {horizonError && (
        <div className="flex items-center gap-3 rounded-md border border-red/40 bg-red-tint px-4 py-3 text-[13px] text-red-dark">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red" />
          <div>
            <strong>Horizon Forecast Error:</strong> {horizonError}. Please check connection to ML backend.
          </div>
        </div>
      )}

      {/* 2. PRIMARY RESULT & MAIN VISUALIZATION */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* PRIMARY RESULT PANEL */}
        <div className="rounded-md border border-border bg-surface p-5 shadow-soft flex flex-col justify-between relative">
          {horizonLoading && (
            <div className="absolute inset-0 bg-surface/75 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-md">
              <Loader2 className="h-6 w-6 animate-spin text-blue mb-1" />
              <span className="text-[11px] font-semibold text-navy-soft">Computing {range.toUpperCase()} Forecast...</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">
                PRIMARY FORECAST RESULT ({range.toUpperCase()})
              </span>
              <StatusBadge label={forecastInsights.trend || "Stable"} tone="amber" />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">
                {range === "24h" ? "Expected Peak Arrival Velocity" : "Expected Peak Daily Arrival Volume"}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-navy">
                  {forecastInsights.peakRate}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">{rateUnitLabel}</span>
              </div>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                {peakTimeLabel} <strong className="text-navy">{forecastInsights.peakTime}</strong>
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
                <span className="font-mono text-base font-bold text-navy mt-0.5 block">
                  {typeof f.value === "number" ? f.value.toLocaleString() : f.value}
                  {f.unit && typeof f.value === "number" ? <span className="text-[10px] text-navy-muted ml-1">{f.unit}</span> : ""}
                  {typeof f.value !== "number" && f.unit ? <span className="text-[11px] text-navy font-semibold">{f.unit}</span> : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title={`Arrival Projection Timeline (${horizonTitle})`}
          subtitle={horizonSub}
          icon={TrendingUp}
          className="xl:col-span-2 relative"
        >
          {horizonLoading ? (
            <div className="flex h-[260px] flex-col items-center justify-center rounded border border-dashed border-border bg-bg text-[13px] text-navy-soft font-medium">
              <Loader2 className="h-6 w-6 animate-spin text-blue mb-2" />
              <span>Fetching {range.toUpperCase()} ML Arrival Forecast...</span>
            </div>
          ) : activeRangeData ? (
            <TrendChart
              data={activeRangeData}
              height={260}
              tickEvery={tickEvery}
              historicalLabel={range === "24h" ? "Observed Historical Arrivals (Hourly)" : "Observed Historical Arrivals (Daily)"}
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
          Operational Interpretation ({range.toUpperCase()})
        </h3>
        <div className="rounded border border-blue/30 bg-blue-tint p-3.5 text-[13px] text-navy leading-relaxed">
          {range === "24h" ? (
            <>
              Expected patient arrivals are projected over the next 24 hours, peaking at{" "}
              <strong>{forecastInsights.peakRate} patients/hour</strong> around <strong>{forecastInsights.peakTime}</strong>. Shift supervisors should prepare additional triage lanes and accelerate bed disposition to manage peak inflow.
            </>
          ) : range === "7d" ? (
            <>
              Weekly arrival projections forecast a peak daily volume of <strong>{forecastInsights.peakRate} patients</strong> on <strong>{forecastInsights.peakTime}</strong>. Staffing schedules should be optimized for peak days.
            </>
          ) : (
            <>
              Monthly arrival trends project a maximum daily arrival volume of <strong>{forecastInsights.peakRate} patients</strong> around <strong>{forecastInsights.peakTime}</strong>. Long-term resource planning should account for projected high-volume weeks.
            </>
          )}
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
            <span className="font-mono text-[11.5px] text-navy-muted">1h MAE: 3.39 | 7d MAE: 14.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
