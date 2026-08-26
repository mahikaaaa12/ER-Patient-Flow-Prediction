import { useEffect, useState } from "react";
import { AlertOctagon, CalendarClock, Info, Play, RefreshCw, Sliders, TrendingUp } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import MLContextCard from "../components/MLContextCard";
import AnomalyTimeline from "../components/AnomalyTimeline";
import StepperControl from "../components/StepperControl";
import { erflowApi } from "../../services/api";
import {
  SURGE_STATUS as MOCK_STATUS,
  RECENT_SURGE_EVENTS as MOCK_EVENTS,
  SURGE_DETECTION_MODEL as MOCK_MODEL,
  SURGE_EXPLANATION as MOCK_EXPLANATION,
} from "../mockData";

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
  const [arrivalRate, setArrivalRate] = useState(32);
  const [occupancy, setOccupancy] = useState(82);
  const [hourOfDay, setHourOfDay] = useState(18);
  const [data, setData] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchSurgeData(rateVal = arrivalRate, occVal = occupancy, hourVal = hourOfDay) {
    setLoading(true);
    setError(null);

    const requestPayload = {
      arrival_rate: rateVal,
      occupancy_percent: occVal,
      hour_of_day: hourVal,
      available_beds: 8,
      available_doctors: 5,
      available_nurses: 9,
      patients_waiting: 24,
      severity_level: 3,
      day_of_week: 4,
      month: 7,
    };

    try {
      const res = await erflowApi.detectSurge(requestPayload);
      setData(res);
    } catch (err) {
      console.warn("Surge detection fetch failed:", err.message);
      setError("Unable to connect to DBSCAN surge detection service at http://localhost:8000.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isRealMode) {
      fetchSurgeData(32, 82, 18);
    } else {
      setLoading(false);
      setError(null);
    }
  }, [isRealMode]);

  const surgeStatus = isRealMode
    ? data
      ? {
          status: data.status,
          severity: data.severity,
          normalRateValue: data.normal_arrival_rate,
          currentRateValue: `${Math.round(data.current_arrival_rate)}`,
          rateUnit: "patients/hr",
          deviation: data.deviation_percent,
          detectedAt: data.detected_at,
          description: data.description,
        }
      : null
    : MOCK_STATUS;

  const modelName = isRealMode ? data?.model_name || "DBSCAN Density Anomaly" : MOCK_MODEL;

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-xl border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic surge detection metrics. Switch to REAL ML MODE in the header for live DBSCAN anomaly detection.</span>
          </div>
        </div>
      )}

      <PageHeader
        title="Patient Surge Detection"
        subtitle="Detect abnormal spikes in patient arrivals by comparing live volume against expected demand."
        action={<ModelBadge model={modelName} />}
      />

      {isRealMode && error && (
        <div className="flex items-center justify-between rounded-xl border border-red/30 bg-red-tint px-4 py-3 text-[13px] text-red">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-red shrink-0" />
            <span>Prediction Unavailable: Unable to connect to DBSCAN surge detection service at http://localhost:8000.</span>
          </div>
          <button
            type="button"
            onClick={() => fetchSurgeData(arrivalRate, occupancy, hourOfDay)}
            className="flex items-center gap-1 font-semibold underline hover:text-red-dark"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Interactive Operational Surge Inputs */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2.5 border-b border-border pb-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-tint text-blue">
            <Sliders className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-navy">Surge Detection Operational Controls</h3>
            <p className="text-[12.5px] text-navy-soft">
              Simulate arrival rate spikes to test surge anomaly detection against normal operational baselines
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StepperControl
            label="Simulated Arrival Volume"
            value={arrivalRate}
            onChange={(val) => setArrivalRate(val)}
            min={5}
            max={60}
            step={1}
            unit="pts/hr"
          />

          <StepperControl
            label="Bed Occupancy"
            value={occupancy}
            onChange={(val) => setOccupancy(val)}
            min={10}
            max={100}
            step={1}
            unit="%"
          />

          <StepperControl
            label="Time of Day"
            value={hourOfDay}
            onChange={(val) => setHourOfDay(val)}
            min={0}
            max={23}
            step={1}
            unit=":00"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => fetchSurgeData(arrivalRate, occupancy, hourOfDay)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue px-5 py-2 text-[13px] font-semibold text-white shadow-soft transition-colors hover:bg-blue-dark disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {loading ? "Running DBSCAN..." : "Run DBSCAN Surge Detection"}
          </button>
        </div>
      </div>

      <ChartCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                surgeStatus.severity === "High"
                  ? "bg-red-tint text-red"
                  : surgeStatus.severity === "Moderate"
                  ? "bg-amber-tint text-amber"
                  : "bg-green-tint text-green"
              }`}
            >
              <AlertOctagon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-soft">Current Status</p>
              <div className="mt-1.5">
                <StatusBadge
                  label={surgeStatus.status}
                  tone={
                    surgeStatus.severity === "High"
                      ? "red"
                      : surgeStatus.severity === "Moderate"
                      ? "amber"
                      : "green"
                  }
                  size="lg"
                />
              </div>
              <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-navy-muted">
                {surgeStatus.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Normal Arrival Rate"
            value={surgeStatus.normalRateValue}
            unit={surgeStatus.rateUnit}
            tone="navy"
          />
          <MetricCard
            label="Current Arrival Rate"
            value={surgeStatus.currentRateValue}
            unit={surgeStatus.rateUnit}
            tone={surgeStatus.severity === "High" ? "red" : "amber"}
          />
          <MetricCard label="Deviation" value={surgeStatus.deviation} tone="red" />
          <MetricCard label="Detected At" value={surgeStatus.detectedAt} tone="navy" />
        </div>
      </ChartCard>

      {/* CONTEXTUAL ML PRESENTATION LAYER */}
      <MLContextCard
        sees={[
          `${arrivalRate} arrivals/hr simulated`,
          `Baseline ${surgeStatus.normalRateValue}/hr`,
          `${occupancy}% occupancy`,
        ]}
        predicts={`${surgeStatus.status} (${surgeStatus.severity} severity)`}
        when="Current Operational Window"
        source={modelName}
      />

      <ChartCard
        title="Arrival Rate Timeline (DBSCAN Evaluated)"
        subtitle="Expected baseline vs. actual arrivals — anomalous periods highlighted by model"
        icon={TrendingUp}
      >
        <AnomalyTimeline data={timelineData.length > 0 ? timelineData : DEFAULT_TIMELINE} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Recent Historical Surge Events"
          subtitle="Reference dataset anomaly log"
          icon={CalendarClock}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MOCK_EVENTS.map((e) => (
              <SurgeEventCard key={e.id} {...e} />
            ))}
          </div>
        </ChartCard>

        <ChartCard title="How Detection Works" icon={Info}>
          <p className="text-[13.5px] leading-relaxed text-navy-muted">{MOCK_EXPLANATION}</p>
          <p className="mt-4 rounded-xl border border-teal/25 bg-teal-tint p-3 text-[12px] leading-relaxed text-navy-soft">
            Status: Powered by DBSCAN anomaly detection against learned operational baselines.
          </p>
        </ChartCard>
      </div>
    </div>
  );
}

const DEFAULT_TIMELINE = [
  { t: "3 PM", expected: 13, actual: 14, anomaly: false },
  { t: "4 PM", expected: 14, actual: 15, anomaly: false },
  { t: "5 PM", expected: 14, actual: 18, anomaly: false },
  { t: "6 PM", expected: 15, actual: 27, anomaly: true },
  { t: "6:30 PM", expected: 15, actual: 32, anomaly: true },
  { t: "7 PM (proj.)", expected: 14, actual: 29, anomaly: true },
];
