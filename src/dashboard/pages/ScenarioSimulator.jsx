import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  RotateCcw,
  Play,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import StepperControl from "../components/StepperControl";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { erflowApi } from "../../services/api";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";

// ─── Preset Scenario Definitions ──────────────────────────────────────────────
const PRESET_SCENARIOS = {
  quiet: {
    label: "Quiet Shift",
    description: "Low arrivals, high bed availability, light triage queue.",
    state: {
      arrival_rate: 10,
      patients_waiting: 5,
      occupancy_percent: 25,
      available_beds: 15,
      available_doctors: 8,
      available_nurses: 12,
      severity_level: 2.0,
      hour_of_day: 3,
      day_of_week: 2,
      month: 7,
    },
  },
  busy: {
    label: "Busy Evening",
    description: "Moderate volume with peak evening arrival velocity.",
    state: {
      arrival_rate: 28,
      patients_waiting: 25,
      occupancy_percent: 78,
      available_beds: 8,
      available_doctors: 5,
      available_nurses: 9,
      severity_level: 3.0,
      hour_of_day: 18,
      day_of_week: 4,
      month: 7,
    },
  },
  surge: {
    label: "Surge Scenario",
    description: "Severe influx, near-capacity occupancy, elevated queue.",
    state: {
      arrival_rate: 52,
      patients_waiting: 58,
      occupancy_percent: 96,
      available_beds: 2,
      available_doctors: 3,
      available_nurses: 5,
      severity_level: 4.2,
      hour_of_day: 20,
      day_of_week: 5,
      month: 7,
    },
  },
};

// ─── Demo-mode deterministic simulation engine ─────────────────────────────────
function computeDemoPredictions(controls) {
  const arr = controls.arrival_rate ?? 28;
  const occ = controls.occupancy_percent ?? 78;
  const wait = controls.patients_waiting ?? 24;
  const beds = controls.available_beds ?? 8;
  const docs = controls.available_doctors ?? 5;
  const nurses = controls.available_nurses ?? 9;
  const acuity = controls.severity_level ?? 3.0;
  const hour = controls.hour_of_day ?? 18;

  const totalStaff = Math.max(1, docs + nurses);
  const ptsPerStaff = wait / totalStaff;
  const ptsPerBed = wait / (Math.max(1, beds) + 1);

  let timeModifier = 0;
  if (hour >= 17 && hour <= 21) timeModifier = 10;
  else if (hour >= 1 && hour <= 5) timeModifier = -15;

  const rawWait =
    12 + wait * 1.2 + arr * 0.5 + ptsPerStaff * 8.0 + ptsPerBed * 6.0 + (acuity - 3.0) * 10.0 + timeModifier;
  const waitTime = Math.max(5, Math.round(rawWait));

  const rawScore = occ * 0.5 + Math.min(40, ptsPerStaff * 12) + (arr / 50) * 20 + (acuity - 3.0) * 5;
  const score = Math.min(100, Math.max(10, Math.round(rawScore)));
  const level = score >= 85 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 45 ? "MODERATE" : "LOW";
  const isSurge = arr > 40 || occ > 88 || ptsPerStaff > 4.0;

  let pattern_name = "Medium Demand";
  let cluster_id = 1;
  if (arr >= 38 || occ >= 85 || wait >= 35) { pattern_name = "High Demand"; cluster_id = 0; }
  else if (arr <= 15 && occ <= 50 && wait <= 10) { pattern_name = "Low Demand"; cluster_id = 2; }

  const top_factors = [
    { feature: "Patients Waiting", direction: wait > 20 ? "increases" : "decreases", importance: 0.45 },
    { feature: "Occupancy Rate",   direction: occ > 75 ? "increases" : "decreases", importance: 0.25 },
    { feature: "Staffing Load",    direction: ptsPerStaff > 2.5 ? "increases" : "decreases", importance: 0.18 },
    { feature: "Arrival Velocity", direction: arr > 30 ? "increases" : "decreases", importance: 0.12 },
  ];

  return {
    waiting_time:    { waiting_time_minutes: waitTime, trend: arr > 30 || wait > 25 ? "Increasing" : "Stable", explanation: { top_factors } },
    crowding_risk:   { crowding_level: level, crowding_score: score, explanation: { top_factors } },
    flow_pattern:    { pattern_name, cluster_id },
    surge_detection: { status: isSurge ? "ANOMALOUS SURGE DETECTED" : "NORMAL OPERATIONAL LOAD", is_surge: isSurge, severity: isSurge ? (arr > 50 || occ > 90 ? "High" : "Moderate") : "Low" },
    patient_forecast: { horizons: { "3h": Math.round(arr * 2.2) } },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function crowdingTone(level) {
  const l = (level || "").toUpperCase();
  if (l === "CRITICAL" || l === "HIGH") return "red";
  if (l === "MODERATE") return "amber";
  return "green";
}

function DeltaTag({ diff, unit = "" }) {
  if (diff === null || diff === undefined) return null;
  const isUp = diff > 0;
  const isDown = diff < 0;
  const cls = isUp ? "text-amber-dark" : isDown ? "text-teal" : "text-navy-muted";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11.5px] font-bold ${cls}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : isDown ? <ArrowDownRight className="h-3 w-3" /> : null}
      {diff > 0 ? `+${diff}` : diff}{unit}
    </span>
  );
}

// ─── Compact baseline row ─────────────────────────────────────────────────────
function BaselineRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
      <span className="text-[12.5px] font-medium text-navy-soft">{label}</span>
      <span className="font-mono text-[13px] font-bold text-navy">{value}</span>
    </div>
  );
}

// ─── Comparison table row ─────────────────────────────────────────────────────
function CompareRow({ label, baseline, scenario, diff, unit = "", diffUnit = "", isLast = false }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-2.5 ${isLast ? "" : "border-b border-border"}`}>
      <span className="text-[12.5px] font-medium text-navy-soft">{label}</span>
      <span className="font-mono text-[12.5px] text-navy-muted text-right">{baseline}{unit}</span>
      <span className="font-mono text-[13px] font-bold text-navy text-right">{scenario}{unit}</span>
      <div className="text-right">
        <DeltaTag diff={diff} unit={diffUnit} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScenarioSimulator() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState } = useERContext();

  const BASELINE_STATE = operationalState;
  const [baselineData, setBaselineData]     = useState(predictions);
  const [scenarioData, setScenarioData]     = useState(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [apiError, setApiError]             = useState(null);
  const [activePreset, setActivePreset]     = useState("custom");
  const [scenarioControls, setScenarioControls] = useState(BASELINE_STATE);

  // Initialise baseline predictions
  useEffect(() => {
    let alive = true;
    async function init() {
      if (predictions) { setBaselineData(predictions); return; }
      try {
        const res = isRealMode
          ? await erflowApi.getDashboardOverview(BASELINE_STATE)
          : computeDemoPredictions(BASELINE_STATE);
        if (alive) setBaselineData(res);
      } catch { /* keep null */ }
    }
    init();
    return () => { alive = false; };
  }, [isRealMode, predictions, operationalState]);

  // Run on mount / mode change
  useEffect(() => { runSimulation(scenarioControls); }, [isRealMode]);

  async function runSimulation(controls = scenarioControls) {
    setLoadingScenario(true);
    setApiError(null);
    try {
      const res = isRealMode
        ? await erflowApi.getDashboardOverview(controls)
        : computeDemoPredictions(controls);
      setScenarioData(res);
    } catch (err) {
      setApiError("Simulation unavailable — ML service offline.");
    } finally {
      setLoadingScenario(false);
    }
  }

  const resetToBaseline = () => {
    setActivePreset("custom");
    setScenarioControls(BASELINE_STATE);
    runSimulation(BASELINE_STATE);
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    const s = PRESET_SCENARIOS[key]?.state;
    if (s) { setScenarioControls(s); runSimulation(s); }
  };

  const updateControl = (field, val) =>
    setScenarioControls((prev) => ({ ...prev, [field]: val }));

  // ── Derived comparison values ──
  const curWait  = baselineData?.waiting_time?.waiting_time_minutes != null ? Math.round(baselineData.waiting_time.waiting_time_minutes) : null;
  const scnWait  = scenarioData?.waiting_time?.waiting_time_minutes != null ? Math.round(scenarioData.waiting_time.waiting_time_minutes) : null;
  const diffWait = curWait != null && scnWait != null ? scnWait - curWait : null;

  const curCrowd  = baselineData?.crowding_risk?.crowding_level ?? "--";
  const scnCrowd  = scenarioData?.crowding_risk?.crowding_level ?? "--";
  const curScore  = baselineData?.crowding_risk?.crowding_score ?? null;
  const scnScore  = scenarioData?.crowding_risk?.crowding_score ?? null;
  const diffScore = curScore != null && scnScore != null ? scnScore - curScore : null;

  const curArr  = BASELINE_STATE.arrival_rate;
  const scnArr  = scenarioControls.arrival_rate;
  const diffArr = scnArr - curArr;

  const curFlow  = baselineData?.flow_pattern?.pattern_name ?? "--";
  const scnFlow  = scenarioData?.flow_pattern?.pattern_name ?? "--";

  const curSurge = baselineData?.surge_detection?.is_surge ? "Surge" : "Normal";
  const scnSurge = scenarioData?.surge_detection?.is_surge ? "Surge" : "Normal";

  const topFactors =
    scenarioData?.waiting_time?.explanation?.top_factors ||
    scenarioData?.crowding_risk?.explanation?.top_factors ||
    [];

  // Interpretation text
  const interpretationText = (() => {
    if (!scenarioData) return null;
    const parts = [];
    if (diffWait !== null && Math.abs(diffWait) >= 1) {
      parts.push(`Expected waiting time is projected to ${diffWait > 0 ? "increase" : "decrease"} by approximately ${Math.abs(diffWait)} minutes compared to current baseline conditions.`);
    }
    if (scnScore !== null && curScore !== null) {
      if (diffScore > 10) parts.push(`Crowding risk score rises from ${curScore} to ${scnScore} — a ${diffScore}-point increase that places the department in ${scnCrowd} territory.`);
      else if (diffScore < -10) parts.push(`Crowding risk score improves from ${curScore} to ${scnScore}, reducing departmental strain.`);
    }
    if (scenarioData?.surge_detection?.is_surge && !baselineData?.surge_detection?.is_surge) {
      parts.push("An arrival surge anomaly would be triggered under these conditions. Surge mitigation protocols should be considered.");
    }
    if (parts.length === 0) return "Projected outcomes remain within expected operational parameters under the current scenario configuration.";
    return parts.join(" ");
  })();

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        section="SIMULATION"
        title="ER Scenario Simulator"
        subtitle="Explore how changes in ER conditions could affect waiting times and crowding risk."
        action={<ModelBadge model="Multi-Model Scenario Engine" />}
      />

      <CentralContextBanner moduleName="ER Scenario Simulator" />

      {/* Mode / error banners */}
      {isDemoMode && (
        <div className="flex items-center gap-2 rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase shrink-0">DEMO MODE</span>
          <span className="font-medium">Simulation uses the deterministic demo engine. Switch to REAL ML MODE for live FastAPI backend evaluation.</span>
        </div>
      )}

      {isRealMode && apiError && (
        <OperationalStatusBanner
          error={apiError}
          moduleName="Scenario Simulation"
          onRetry={() => runSimulation()}
        />
      )}

      {/* ── STEP 1 + 2: Baseline & Scenario Inputs (side-by-side) ─────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* ── STEP 1: CURRENT BASELINE ──────────────────────────────────────── */}
        <div className="lg:col-span-4">
          <div className="rounded-md border border-border bg-surface p-5 shadow-soft h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-navy-soft block">
                  STEP 1
                </span>
                <h3 className="text-[14px] font-bold text-navy">Current Baseline</h3>
              </div>
              <StatusBadge label="Live Conditions" tone="teal" />
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <BaselineRow
                  label="Occupancy"
                  value={`${BASELINE_STATE.occupancy_percent}%`}
                />
                <BaselineRow
                  label="Patients waiting"
                  value={`${BASELINE_STATE.patients_waiting} pts`}
                />
                <BaselineRow
                  label="Available beds"
                  value={`${BASELINE_STATE.available_beds} beds`}
                />
                <BaselineRow
                  label="Active physicians"
                  value={`${BASELINE_STATE.available_doctors} MD/DO`}
                />
                <BaselineRow
                  label="Active nurses"
                  value={`${BASELINE_STATE.available_nurses} RN`}
                />
                <BaselineRow
                  label="Arrival velocity"
                  value={`${BASELINE_STATE.arrival_rate} pts/hr`}
                />
                <BaselineRow
                  label="Acuity level"
                  value={`ESI ${BASELINE_STATE.severity_level?.toFixed(1)}`}
                />
              </div>

              <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2">
                <div className="rounded border border-border bg-bg p-2.5">
                  <span className="text-[10.5px] font-semibold text-navy-soft block">Baseline Wait</span>
                  <span className="font-mono text-base font-bold text-navy">
                    {curWait != null ? `${curWait} min` : "--"}
                  </span>
                </div>
                <div className="rounded border border-border bg-bg p-2.5">
                  <span className="text-[10.5px] font-semibold text-navy-soft block">Crowding</span>
                  <span className="font-mono text-base font-bold text-navy">{curCrowd}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 2: SCENARIO CONDITIONS ───────────────────────────────────── */}
        <div className="lg:col-span-8">
          <div className="rounded-md border border-border bg-surface p-5 shadow-soft h-full flex flex-col">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3 mb-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-navy-soft block">
                  STEP 2
                </span>
                <h3 className="text-[14px] font-bold text-navy">Scenario Conditions</h3>
                <p className="text-[12px] text-navy-muted mt-0.5">
                  Adjust operational variables to define the scenario to evaluate.
                </p>
              </div>

              {/* Preset quick-select */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={resetToBaseline}
                  className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-navy-soft hover:bg-surface hover:text-navy transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                {Object.keys(PRESET_SCENARIOS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={`rounded border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      activePreset === key
                        ? "border-blue bg-blue-tint text-blue"
                        : "border-border bg-bg text-navy-soft hover:bg-surface hover:text-navy"
                    }`}
                  >
                    {PRESET_SCENARIOS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 flex-1">
              <StepperControl
                label="Expected Arrivals"
                unit="pts/hr"
                value={scenarioControls.arrival_rate}
                onChange={(v) => updateControl("arrival_rate", v)}
                min={0} max={100} step={1}
              />
              <StepperControl
                label="Patients Waiting"
                unit="pts"
                value={scenarioControls.patients_waiting}
                onChange={(v) => updateControl("patients_waiting", v)}
                min={0} max={150} step={1}
              />
              <StepperControl
                label="Occupancy"
                unit="%"
                value={scenarioControls.occupancy_percent}
                onChange={(v) => updateControl("occupancy_percent", v)}
                min={0} max={100} step={1}
              />
              <StepperControl
                label="Available Beds"
                unit="beds"
                value={scenarioControls.available_beds}
                onChange={(v) => updateControl("available_beds", v)}
                min={0} max={50} step={1}
              />
              <StepperControl
                label="Available Physicians"
                unit="MD"
                value={scenarioControls.available_doctors}
                onChange={(v) => updateControl("available_doctors", v)}
                min={1} max={25} step={1}
              />
              <StepperControl
                label="Available Nurses"
                unit="RN"
                value={scenarioControls.available_nurses}
                onChange={(v) => updateControl("available_nurses", v)}
                min={1} max={40} step={1}
              />
              <StepperControl
                label="Patient Acuity"
                unit="lvl"
                value={scenarioControls.severity_level}
                onChange={(v) => updateControl("severity_level", v)}
                min={1.0} max={5.0} step={0.1}
              />
              <StepperControl
                label="Hour of Day"
                unit=":00"
                value={scenarioControls.hour_of_day}
                onChange={(v) => updateControl("hour_of_day", v)}
                min={0} max={23} step={1}
              />
            </div>

            {/* ── STEP 3: RUN SIMULATION ───────────────────────────────────── */}
            <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-navy-soft block">STEP 3</span>
                <p className="text-[12px] text-navy-muted">
                  {activePreset !== "custom" && PRESET_SCENARIOS[activePreset]
                    ? `Preset: ${PRESET_SCENARIOS[activePreset].label} — ${PRESET_SCENARIOS[activePreset].description}`
                    : "Custom scenario configured. Run to evaluate projected impact."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => runSimulation()}
                disabled={loadingScenario}
                className="inline-flex items-center gap-2 rounded-md bg-navy px-5 py-2.5 text-[13px] font-bold text-white hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {loadingScenario ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Running simulation…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Run Scenario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP 4: PROJECTED IMPACT ─────────────────────────────────────────── */}
      {scenarioData && (
        <div className="flex flex-col gap-5">

          {/* Section label */}
          <div className="flex items-center gap-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">STEP 4</span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* ── Primary impact metrics ───────────────────────────────────────── */}
          <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
                Projected Operational Impact
              </h3>
              <StatusBadge
                label={isRealMode ? "Live ML Evaluation" : "Demo Engine"}
                tone={isRealMode ? "teal" : "amber"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {/* Waiting Time */}
              <div className="rounded border border-border bg-bg p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Waiting Time</span>
                <span className="font-mono text-2xl font-bold text-navy mt-1">
                  {scnWait != null ? `${scnWait} min` : "--"}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-navy-muted">Baseline {curWait != null ? `${curWait} min` : "--"}</span>
                  <DeltaTag diff={diffWait} unit=" min" />
                </div>
              </div>

              {/* Crowding Risk */}
              <div className="rounded border border-border bg-bg p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Crowding Risk</span>
                <div className="mt-1">
                  <StatusBadge label={scnCrowd} tone={crowdingTone(scnCrowd)} size="lg" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-navy-muted">Baseline {curCrowd}</span>
                  <DeltaTag diff={diffScore} unit=" pts" />
                </div>
              </div>

              {/* Arrival Rate */}
              <div className="rounded border border-border bg-bg p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Arrival Rate</span>
                <span className="font-mono text-2xl font-bold text-navy mt-1">{scnArr} /hr</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-navy-muted">Baseline {curArr} /hr</span>
                  <DeltaTag diff={diffArr} unit=" /hr" />
                </div>
              </div>

              {/* Flow Pattern */}
              <div className="rounded border border-border bg-bg p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Flow Pattern</span>
                <span className="font-mono text-sm font-bold text-navy mt-1 leading-snug">{scnFlow}</span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[11px] text-navy-muted">from</span>
                  <span className="text-[11px] font-medium text-navy-soft">{curFlow}</span>
                </div>
              </div>

              {/* Surge Status */}
              <div className="rounded border border-border bg-bg p-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Surge Status</span>
                <div className="mt-1">
                  <StatusBadge
                    label={scnSurge}
                    tone={scnSurge === "Surge" ? "red" : "green"}
                    size="lg"
                  />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[11px] text-navy-muted">Baseline: {curSurge}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Side-by-side comparison table ───────────────────────────────── */}
          <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-1">
              Baseline vs Scenario Comparison
            </h3>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-2 border-b border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">Metric</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft text-right">Baseline</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft text-right">Scenario</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft text-right">Change</span>
            </div>

            <CompareRow
              label="Expected waiting time"
              baseline={curWait != null ? curWait : "--"}
              scenario={scnWait != null ? scnWait : "--"}
              diff={diffWait}
              unit=" min"
              diffUnit=" min"
            />
            <CompareRow
              label="Crowding risk score"
              baseline={curScore != null ? curScore : "--"}
              scenario={scnScore != null ? scnScore : "--"}
              diff={diffScore}
              unit=" / 100"
              diffUnit=" pts"
            />
            <CompareRow
              label="Crowding risk level"
              baseline={curCrowd}
              scenario={scnCrowd}
              diff={null}
            />
            <CompareRow
              label="Patient arrival rate"
              baseline={curArr}
              scenario={scnArr}
              diff={diffArr}
              unit=" /hr"
              diffUnit=" /hr"
            />
            <CompareRow
              label="Bed occupancy"
              baseline={BASELINE_STATE.occupancy_percent}
              scenario={scenarioControls.occupancy_percent}
              diff={scenarioControls.occupancy_percent - BASELINE_STATE.occupancy_percent}
              unit="%"
              diffUnit="%"
            />
            <CompareRow
              label="Available beds"
              baseline={BASELINE_STATE.available_beds}
              scenario={scenarioControls.available_beds}
              diff={scenarioControls.available_beds - BASELINE_STATE.available_beds}
              unit=" beds"
              diffUnit=" beds"
            />
            <CompareRow
              label="Flow regime"
              baseline={curFlow}
              scenario={scnFlow}
              diff={null}
              isLast={true}
            />
          </div>

          {/* ── Operational Interpretation ────────────────────────────────────── */}
          <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
              Operational Interpretation
            </h3>
            <p className="text-[13.5px] leading-relaxed text-navy">
              {interpretationText}
            </p>

            {/* Top contributing factors */}
            {topFactors.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-navy-soft mb-2">
                  Contributing Prediction Factors (TreeSHAP)
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {topFactors.map((f, i) => {
                    const isUp = f.direction === "increases";
                    return (
                      <div key={i} className="flex items-center justify-between rounded border border-border bg-bg px-3 py-2">
                        <span className="text-[12px] font-semibold text-navy">{f.feature}</span>
                        <span className={`text-[12px] font-bold font-mono ${isUp ? "text-amber-dark" : "text-teal"}`}>
                          {isUp ? "↑" : "↓"} {Math.round(f.importance * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
