import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Waves,
  X,
  Zap,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageCard from "../components/PageCard";
import ModelBadge from "../components/ModelBadge";
import StatusBadge from "../components/StatusBadge";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import EROperationsControlPanel from "../components/EROperationsControlPanel";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";
import { erflowApi } from "../../services/api";

const PRESSURE_CONFIG = {
  CRITICAL: {
    badge: "red",
    bg: "border-red/40 bg-red-tint/50 text-red",
    indicatorBg: "bg-red",
    text: "CRITICAL OPERATIONAL STRAIN",
    description: "Department throughput is severely saturated. Immediate resource re-allocation required.",
  },
  HIGH: {
    badge: "red",
    bg: "border-red/30 bg-red-tint/30 text-red",
    indicatorBg: "bg-red",
    text: "HIGH OPERATIONAL PRESSURE",
    description: "Department capacity and queue times are approaching strain limits.",
  },
  MODERATE: {
    badge: "amber",
    bg: "border-amber/40 bg-amber-tint/40 text-amber-dark",
    indicatorBg: "bg-amber",
    text: "MODERATE PRESSURE",
    description: "Operational load is elevated but manageable within current staffing baselines.",
  },
  LOW: {
    badge: "green",
    bg: "border-green/40 bg-green-tint/40 text-green",
    indicatorBg: "bg-green",
    text: "STABLE / NORMAL LOAD",
    description: "Department operations and queue throughput are operating within baseline limits.",
  },
};

const CATEGORY_ICONS = {
  "TRIAGE CAPACITY": Activity,
  "BED CAPACITY": ShieldAlert,
  "STAFFING": Users,
  "ARRIVAL PRESSURE": Waves,
  "WAITING QUEUE": Clock,
  "CROWDING": AlertTriangle,
  "SURGE": Zap,
  "FLOW": TrendingUp,
};

export default function EDCommandOrchestrator() {
  const navigate = useNavigate();
  const { isRealMode, isDemoMode } = useMode();
  const {
    operationalState,
    predictions,
    loading: erLoading,
    error: erError,
    lastUpdated,
    modelStatus,
    hasRunPredictions,
    updatePredictions,
  } = useERContext();

  const [orchData, setOrchData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeWhyModal, setActiveWhyModal] = useState(null);
  const [lastEvaluatedTime, setLastEvaluatedTime] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  });

  // ACTION QUEUE STATE
  const [actionFilter, setActionFilter] = useState("ALL");
  const [actionQueueData, setActionQueueData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatuses, setActionStatuses] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erflow_action_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Refs for tracking input snapshot comparison and preventing race conditions
  const prevInputSignatureRef = useRef("");
  const activeRequestIdRef = useRef(0);
  const isCalculatingRef = useRef(false);

  const getInputSignature = (state, isReal) => {
    if (!state) return "";
    return [
      state.occupancy_percent ?? 78,
      state.patients_waiting ?? 24,
      state.arrival_rate ?? 28,
      state.available_beds ?? 8,
      state.available_doctors ?? 5,
      state.available_nurses ?? 9,
      state.severity_level ?? 3.0,
      isReal ? "real" : "demo",
    ].join("|");
  };

  // Fetch Action Queue from API or build fallback
  const fetchActionQueue = async (filter = actionFilter, currentOrchData = orchData) => {
    setActionLoading(true);
    try {
      if (isRealMode) {
        // Fetch persisted action queue using GET request without triggering ML calculation
        const res = await erflowApi.getActionQueue(null, filter);
        setActionQueueData(res);
      } else {
        const actions = (currentOrchData?.recommended_actions || []).map((rec) => {
          const status = actionStatuses[rec.id] || "NEW";
          return {
            id: rec.id,
            category: rec.category,
            title: rec.title,
            recommendation: rec.recommended_action,
            priority: rec.priority,
            created_at: rec.timestamp || new Date().toISOString(),
            due_time: `In ${rec.due_in_minutes || 30} mins`,
            status: status,
            contributing_factors: rec.contributing_factors?.map(f => typeof f === "string" ? f : f.name) || ["Telemetry Load"],
            source_prediction: rec.category === "BED CAPACITY" ? "Supervised XGBoost Classifier (Crowding Risk)" : "Supervised XGBoost Regressor (Wait Time)",
            urgency: rec.urgency,
            reason: rec.reason,
            explanation_detail: rec.explanation_detail,
          };
        });

        let filtered = actions;
        if (filter === "HIGH PRIORITY") filtered = actions.filter(a => a.priority === "HIGH" || a.priority === "CRITICAL");
        else if (filter === "NEW") filtered = actions.filter(a => a.status === "NEW");
        else if (filter === "ACKNOWLEDGED") filtered = actions.filter(a => a.status === "ACKNOWLEDGED");
        else if (filter === "COMPLETED") filtered = actions.filter(a => a.status === "COMPLETED");

        const openCnt = actions.filter(a => a.status !== "COMPLETED").length;
        const highCnt = actions.filter(a => a.priority === "HIGH" || a.priority === "CRITICAL").length;
        const compCnt = actions.filter(a => a.status === "COMPLETED").length;

        setActionQueueData({
          summary: { open_actions: openCnt, high_priority: highCnt, completed: compCnt, total_actions: actions.length },
          actions: filtered,
          filter_applied: filter,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch Action Queue:", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Run Orchestrator Evaluation strictly ONCE when meaningful input snapshot changes
  const runOrchestratorEvaluation = async (manual = false) => {
    const currentSig = getInputSignature(operationalState, isRealMode);

    // Guard: skip if signature unchanged and we already have results (non-manual)
    if (!manual && currentSig === prevInputSignatureRef.current && orchData) {
      console.log("[ORCHESTRATOR] Input snapshot unchanged → skipping calculation");
      return;
    }

    // Guard: skip if already calculating (non-manual only — manual always proceeds)
    if (!manual && isCalculatingRef.current) {
      console.log("[ORCHESTRATOR] Calculation already in progress → skipping duplicate trigger");
      return;
    }

    if (manual) {
      console.log("[ORCHESTRATOR] Manual re-evaluation requested");
    } else {
      console.log("[ORCHESTRATOR] Input snapshot changed → calculation started");
    }

    prevInputSignatureRef.current = currentSig;
    const reqId = ++activeRequestIdRef.current;
    isCalculatingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      let resData = null;
      if (isRealMode) {
        console.log("[ORCHESTRATOR] API Call: POST /api/orchestrator/analyze", operationalState);
        resData = await erflowApi.getOrchestratorAnalysis(operationalState);
      } else {
        const occ = operationalState.occupancy_percent || 78;
        const waiting = operationalState.patients_waiting || 24;
        const beds = operationalState.available_beds || 8;
        const arrRate = operationalState.arrival_rate || 28;
        const docs = operationalState.available_doctors || 5;
        const nurses = operationalState.available_nurses || 9;

        const docRatio = Number((waiting / docs).toFixed(1));
        const nurseRatio = Number(((waiting + (occ / 100) * 35) / nurses).toFixed(1));

        const score = Math.min(100, Math.round(occ * 0.4 + (waiting / 40) * 35 + (arrRate / 40) * 25));
        const level = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 35 ? "MODERATE" : "LOW";

        resData = {
          overall_pressure_score: score,
          pressure_level: level,
          workload_assessment: {
            doctor_load_ratio: docRatio,
            nurse_load_ratio: nurseRatio,
            bed_occupancy_percent: occ,
            current_workload_level: level,
            upcoming_3h_workload_level: arrRate > 30 ? "HIGH" : "MODERATE",
            summary: `Demo Analysis: Department pressure is ${level} (${score}/100). Physician load is ${docRatio} pts/MD and nurse load is ${nurseRatio} active pts/RN.`,
          },
          prioritized_issues: [
            {
              id: "iss-triage",
              category: "TRIAGE CAPACITY",
              severity: waiting > 20 ? "HIGH" : "MODERATE",
              title: "Triage Queue Bottleneck",
              description: `Queue length (${waiting} pts) exceeds target intake threshold.`,
              affected_metrics: ["patients_waiting", "waiting_time_minutes"],
            },
            {
              id: "iss-bed",
              category: "BED CAPACITY",
              severity: occ > 80 ? "HIGH" : "MODERATE",
              title: "Bed Occupancy Pressure",
              description: `Occupancy is at ${occ}% capacity with ${beds} available beds.`,
              affected_metrics: ["occupancy_percent", "available_beds"],
            },
          ],
          recommended_actions: [
            {
              id: "rec-triage-capacity",
              category: "TRIAGE CAPACITY",
              priority: waiting > 20 ? "HIGH" : "MODERATE",
              title: "Review Triage Staffing for Upcoming Demand",
              description: "Queue pressure is increasing in initial screening.",
              recommended_action: "Assign auxiliary triage screening nurse and open fast-track intake bay.",
              urgency: "WITHIN 30 MIN",
              due_in_minutes: 30,
              contributing_factors: [
                { name: "Patients Waiting", impact: "increases_pressure", contribution_score: waiting, detail: `${waiting} patients waiting in queue` },
                { name: "Arrival Velocity", impact: "increases_pressure", contribution_score: arrRate, detail: `${arrRate} arrivals per hour` },
                { name: "Predicted Demand", impact: "increases_pressure", contribution_score: arrRate * 2.4, detail: "LSTM projects rising inflow" },
              ],
              reason: "Queue length and arrival velocity indicate rising triage bottleneck.",
              confidence: "HIGH",
              requires_human_review: true,
            },
            {
              id: "rec-bed-capacity",
              category: "BED CAPACITY",
              priority: occ > 80 ? "HIGH" : "MODERATE",
              title: "Initiate Accelerated Inpatient Bed Transfers",
              description: `ED bed occupancy is at ${occ}% capacity.`,
              recommended_action: "Coordinate with hospital bed command to expedite pending inpatient admissions.",
              urgency: "WITHIN 30 MIN",
              due_in_minutes: 25,
              contributing_factors: [
                { name: "Occupancy Percent", impact: "increases_pressure", contribution_score: occ, detail: `${occ}% capacity utilized` },
                { name: "Available Beds", impact: "increases_pressure", contribution_score: beds, detail: `Only ${beds} beds available` },
              ],
              reason: "High bed occupancy reduces treatment bay turnover for new arrivals.",
              confidence: "HIGH",
              requires_human_review: true,
            },
          ],
          ml_engine_status: {
            forecast: "demo",
            waiting_time: "demo",
            crowding_risk: "demo",
            flow_pattern: "demo",
            surge_detection: "demo",
          },
          degraded_mode: false,
          data_sources_used: [
            "Demo Telemetry Feed",
            "XGBoost Regressor & Classifier",
            "LSTM Neural Network",
          ],
          timestamp: new Date().toISOString(),
        };
      }

      if (reqId === activeRequestIdRef.current) {
        setOrchData(resData);
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastEvaluatedTime(now);
        console.log("[ORCHESTRATOR] Calculation completed");
      }
    } catch (err) {
      if (reqId === activeRequestIdRef.current) {
        console.warn("Orchestrator API call failed:", err.message);
        setError(err.message || "Failed to retrieve orchestrator analysis");
      }
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Evaluation triggered ONLY when operational input snapshot changes
  useEffect(() => {
    runOrchestratorEvaluation();
  }, [
    isRealMode,
    operationalState?.occupancy_percent,
    operationalState?.patients_waiting,
    operationalState?.arrival_rate,
    operationalState?.available_beds,
    operationalState?.available_doctors,
    operationalState?.available_nurses,
    operationalState?.severity_level,
  ]);

  useEffect(() => {
    if (orchData) {
      fetchActionQueue(actionFilter, orchData);
    }
  }, [orchData, actionFilter, isRealMode]);


  const handleUpdateActionStatus = async (actionId, newStatus) => {
    const updated = { ...actionStatuses, [actionId]: newStatus };
    setActionStatuses(updated);
    try {
      sessionStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist action status in session:", e);
    }

    if (isRealMode) {
      try {
        await erflowApi.updateActionStatus(actionId, newStatus);
      } catch (err) {
        console.warn("Error updating action status via API:", err.message);
      }
    }
    fetchActionQueue(actionFilter);
  };

  const handleFilterChange = (filter) => {
    setActionFilter(filter);
    fetchActionQueue(filter);
  };

  const handleSimulateRecommendation = (rec) => {
    const suggested = { ...operationalState };

    if (rec.category === "TRIAGE CAPACITY" || rec.category === "WAITING QUEUE") {
      suggested.available_nurses = Math.min(40, (operationalState.available_nurses || 9) + 1);
      suggested.patients_waiting = Math.max(0, (operationalState.patients_waiting || 24) - 5);
    } else if (rec.category === "BED CAPACITY" || rec.category === "CROWDING") {
      suggested.available_beds = Math.min(50, (operationalState.available_beds || 8) + 4);
      suggested.occupancy_percent = Math.max(20, (operationalState.occupancy_percent || 78) - 10);
    } else if (rec.category === "STAFFING") {
      suggested.available_doctors = Math.min(25, (operationalState.available_doctors || 5) + 1);
      suggested.available_nurses = Math.min(40, (operationalState.available_nurses || 9) + 2);
    } else if (rec.category === "SURGE" || rec.category === "ARRIVAL PRESSURE") {
      suggested.arrival_rate = Math.max(10, (operationalState.arrival_rate || 28) - 8);
      suggested.available_beds = Math.min(50, (operationalState.available_beds || 8) + 3);
    } else {
      suggested.available_doctors = Math.min(25, (operationalState.available_doctors || 5) + 1);
      suggested.available_nurses = Math.min(40, (operationalState.available_nurses || 9) + 1);
    }

    navigate("/dashboard/scenario-simulator", {
      state: {
        intervention: rec,
        suggestedState: suggested,
      },
    });
  };

  const pressureLevel = orchData?.pressure_level || "MODERATE";
  const pressureCfg = PRESSURE_CONFIG[pressureLevel] || PRESSURE_CONFIG.MODERATE;

  // Build upcoming 6-hour timeline from LSTM forecast series or operationalState
  const forecastSeries = predictions?.forecast?.series || [];
  const timelineHours = ["NOW", "+1 HR", "+2 HR", "+3 HR", "+4 HR", "+5 HR", "+6 HR"];

  const upcomingTimeline = timelineHours.map((label, idx) => {
    const isNow = idx === 0;
    let rate = operationalState.arrival_rate || 28;
    if (!isNow && forecastSeries.length > 0) {
      const forecastItem = forecastSeries[12 + idx] || forecastSeries[idx];
      if (forecastItem && typeof forecastItem.value === "number") {
        rate = forecastItem.value;
      } else {
        rate = Math.round(rate * (1 + 0.05 * idx));
      }
    } else if (!isNow) {
      rate = Math.round(rate * (1 + 0.04 * idx));
    }

    let level = "LOW";
    if (rate >= 38) level = "CRITICAL";
    else if (rate >= 30) level = "HIGH";
    else if (rate >= 22) level = "MODERATE";

    return {
      label,
      rate: Math.round(rate),
      level,
      kind: isNow ? "CURRENT" : "FORECAST",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* PAGE HEADER */}
      <PageHeader
        section="DEPARTMENT COMMAND CENTER"
        title="⚡ Operations Command Center"
        subtitle="Real-time healthcare-worker-focused operational orchestrator combining ML predictions, staffing ratios, and resource actions."
        action={<ModelBadge model={isRealMode ? "FastAPI Orchestrator Service" : "Demo Orchestrator Engine"} />}
      />

      {/* AUTOMATIC RE-EVALUATION STATUS & SYNCHRONIZATION BANNER */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-[12.5px] shadow-soft">
        <div className="flex items-center gap-2">
          {loading || erLoading ? (
            <div className="flex items-center gap-2 text-blue font-bold">
              <Loader2 className="h-4 w-4 animate-spin text-blue" />
              <span>Recalculating operational command state, workload pressure & resource actions...</span>
            </div>
          ) : erError || error || orchData?.degraded_mode ? (
            <div className="flex items-center gap-2 text-amber-dark font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber shrink-0" />
              <span>Telemetry Warning: ML engine offline or degraded. Fallback operational heuristics active.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-navy font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-teal animate-pulse" />
              <span>Automatic Re-evaluation Active — Synced with ER Operational Context</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] font-semibold text-navy-soft">
            Last evaluated: <strong className="text-navy font-bold">{lastEvaluatedTime}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              runOrchestratorEvaluation(true);
            }}
            disabled={loading || erLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1 text-[11.5px] font-bold text-navy hover:bg-surface hover:text-blue transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-blue ${loading || erLoading ? "animate-spin" : ""}`} />
            Re-evaluate
          </button>
        </div>
      </div>

      {/* Operational Status & Telemetry Banner */}
      {isRealMode && (
        <OperationalStatusBanner
          loading={erLoading || loading}
          error={erError || error}
          lastUpdated={lastUpdated}
          modelStatus={modelStatus}
          hasRunPredictions={hasRunPredictions}
          onRetry={() => {
            runOrchestratorEvaluation(true);
          }}
        />
      )}

      {/* 1. CURRENT OPERATIONAL PRESSURE */}
      <div className={`rounded-lg border p-5 shadow-soft transition-all ${pressureCfg.bg}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-navy/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white shadow-soft">
              <Zap className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft">
                  Current Operational Pressure
                </span>
                <StatusBadge label={pressureLevel} tone={pressureCfg.badge} />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl mt-0.5">
                {pressureCfg.text}
              </h2>
              <p className="text-[13px] font-medium text-navy-soft mt-0.5">
                {pressureCfg.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-navy/10 pt-3 lg:border-t-0 lg:pt-0">
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block">
                Composite Pressure Score
              </span>
              <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                <span className="font-mono text-3xl font-bold text-navy">
                  {orchData?.overall_pressure_score ?? 68.5}
                </span>
                <span className="text-[13px] font-semibold text-navy-soft">/ 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS GRID */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 text-[13px]">
          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Occupancy</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.occupancy_percent}%
            </span>
            <span className="text-[11px] font-medium text-navy-muted">Bed Capacity</span>
          </div>

          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Patients Waiting</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.patients_waiting}
            </span>
            <span className="text-[11px] font-medium text-navy-muted">Triage Queue</span>
          </div>

          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Arrival Velocity</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.arrival_rate} <span className="text-xs font-normal">pts/hr</span>
            </span>
            <span className="text-[11px] font-medium text-navy-muted">Inflow Rate</span>
          </div>

          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Available Beds</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.available_beds}
            </span>
            <span className="text-[11px] font-medium text-navy-muted">Staffed Beds</span>
          </div>

          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Active Doctors</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.available_doctors} <span className="text-xs font-normal">MD/DO</span>
            </span>
            <span className="text-[11px] font-medium text-navy-muted">On Shift</span>
          </div>

          <div className="rounded-md border border-navy/10 bg-surface/80 p-3">
            <span className="text-[11px] font-semibold text-navy-soft block uppercase tracking-wider">Active Nurses</span>
            <span className="font-mono text-xl font-bold text-navy mt-1 block">
              {operationalState.available_nurses} <span className="text-xs font-normal">RN/BSN</span>
            </span>
            <span className="text-[11px] font-medium text-navy-muted">On Shift</span>
          </div>
        </div>
      </div>

      {/* CENTRAL CONTROL PANEL FOR SIMULATING PARAMETERS */}
      <EROperationsControlPanel />

      {/* 2. WHAT NEEDS ATTENTION? (PRIORITIZED OPERATIONAL CARDS) */}
      <PageCard
        title="What Needs Attention?"
        subtitle="Prioritized operational issues and recommended resource management actions derived from real ML prediction engines"
        icon={AlertTriangle}
      >
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-navy-soft">
            <Loader2 className="h-5 w-5 animate-spin text-blue" />
            <span>Evaluating department operational strain and ML outputs...</span>
          </div>
        ) : !orchData?.recommended_actions || orchData.recommended_actions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-green/30 bg-green-tint px-4 py-4 text-green">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <h4 className="text-[14px] font-semibold">All operational parameters within normal baseline.</h4>
              <p className="text-[12.5px] text-green/90">No urgent triage, bed capacity, or staffing bottlenecks detected by ML prediction models.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orchData.recommended_actions.map((rec) => {
              const CategoryIcon = CATEGORY_ICONS[rec.category] || AlertTriangle;
              const isAck = actionStatuses[rec.id] === "ACKNOWLEDGED" || actionStatuses[rec.id] === "COMPLETED";

              return (
                <div
                  key={rec.id}
                  className={`flex flex-col justify-between rounded-lg border p-4 shadow-soft transition-all ${
                    isAck
                      ? "border-border bg-bg/60 opacity-80"
                      : rec.priority === "CRITICAL"
                      ? "border-red/40 bg-red-tint/20"
                      : rec.priority === "HIGH"
                      ? "border-amber/40 bg-amber-tint/20"
                      : "border-border bg-surface"
                  }`}
                >
                  <div>
                    {/* CARD TOP BADGES */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5 mb-3">
                      <div className="flex items-center gap-1.5">
                        <CategoryIcon className="h-4 w-4 text-blue shrink-0" />
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-navy">
                          {rec.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          label={rec.priority}
                          tone={rec.priority === "CRITICAL" || rec.priority === "HIGH" ? "red" : "amber"}
                        />
                        <span className="rounded border border-border bg-bg px-2 py-0.5 font-mono text-[10.5px] font-semibold text-navy-soft">
                          {rec.urgency}
                        </span>
                      </div>
                    </div>

                    {/* ISSUE TITLE & DESCRIPTION */}
                    <h3 className="text-[15px] font-bold text-navy leading-snug">
                      {rec.title}
                    </h3>
                    <p className="mt-1 text-[12.5px] text-navy-soft leading-relaxed">
                      {rec.description}
                    </p>

                    {/* RECOMMENDED ACTION HIGHLIGHT */}
                    <div className="mt-3 rounded-md border border-blue/20 bg-blue-tint/50 p-3 text-[12.5px] text-navy">
                      <span className="font-bold text-blue-dark block uppercase tracking-wider text-[10.5px] mb-0.5">
                        Recommended Operational Action:
                      </span>
                      <p className="font-medium text-navy-dark leading-snug">
                        {rec.recommended_action}
                      </p>
                    </div>

                    {/* CONTRIBUTING FACTORS SUMMARY */}
                    {rec.contributing_factors && rec.contributing_factors.length > 0 && (
                      <div className="mt-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-1">
                          Contributing Factors:
                        </span>
                        <ul className="flex flex-col gap-1 text-[12px] text-navy-muted">
                          {rec.contributing_factors.slice(0, 3).map((factor, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue shrink-0" />
                              <span className="font-semibold text-navy">{factor.name}:</span>
                              <span>{factor.detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[12px]">
                    <span className="font-mono font-semibold text-navy-soft">
                      Due in: <strong className="text-navy">{rec.due_in_minutes} min</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveWhyModal(rec)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-navy hover:bg-surface hover:text-blue transition-colors"
                      >
                        <HelpCircle className="h-3.5 w-3.5 text-blue" />
                        Why?
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulateRecommendation(rec)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2.5 py-1 text-[11.5px] font-semibold text-navy hover:bg-surface hover:text-teal transition-colors"
                      >
                        <Sliders className="h-3.5 w-3.5 text-teal" />
                        Simulate
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rec.id)}
                        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-[11.5px] font-bold transition-all ${
                          isAck
                            ? "border border-green/40 bg-green-tint text-green"
                            : "bg-navy text-white hover:bg-navy-muted"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {actionStatuses[rec.id] || "Acknowledge"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageCard>

      {/* 3. UPCOMING WORKLOAD (NEXT 6 HOURS TIMELINE) */}
      <PageCard
        title="Upcoming Workload Timeline (Next 6 Hours)"
        subtitle="Expected department pressure and arrival rate across upcoming hourly horizons derived from the 2-Layer LSTM forecasting engine"
        icon={Clock}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {upcomingTimeline.map((item, idx) => {
            const isNow = item.kind === "CURRENT";
            const toneMap = {
              CRITICAL: "border-red/40 bg-red-tint/30 text-red",
              HIGH: "border-amber/40 bg-amber-tint/30 text-amber-dark",
              MODERATE: "border-blue/30 bg-blue-tint/30 text-blue-dark",
              LOW: "border-green/30 bg-green-tint/30 text-green",
            };

            return (
              <div
                key={idx}
                className={`flex flex-col justify-between rounded-md border p-3 text-center transition-all ${
                  isNow ? "border-navy bg-navy text-white shadow-soft" : toneMap[item.level] || "border-border bg-bg"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-1 mb-1.5">
                    <span className={`font-mono text-[10px] font-bold tracking-wider uppercase ${isNow ? "text-white/70" : "text-navy-soft"}`}>
                      {item.label}
                    </span>
                    <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${isNow ? "bg-white/20 text-white" : "bg-bg border border-border text-navy-soft"}`}>
                      {item.kind}
                    </span>
                  </div>

                  <span className={`font-mono text-xl font-bold block mt-1 ${isNow ? "text-white" : "text-navy"}`}>
                    {item.rate}
                  </span>
                  <span className={`text-[10.5px] block font-medium ${isNow ? "text-white/80" : "text-navy-muted"}`}>
                    arrivals / hr
                  </span>
                </div>

                <div className="mt-2.5 border-t border-border/40 pt-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isNow ? "text-blue-tint" : ""}`}>
                    {item.level} PRESSURE
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </PageCard>

      {/* 4. RESOURCE PRESSURE & STAFFING RATIOS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PageCard
          title="Resource Pressure & Staff Workload Ratios"
          subtitle="Real-time workload strain indicators for physicians, nurses, beds, and triage"
          icon={Users}
        >
          <div className="flex flex-col gap-4 text-[13px]">
            {/* NURSING WORKLOAD */}
            <div className="rounded-md border border-border bg-bg p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy">Nursing Staff Load Ratio</span>
                <span className="font-mono font-bold text-navy">
                  {orchData?.workload_assessment?.nurse_load_ratio ?? 5.7} active pts / RN
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-amber transition-all"
                  style={{ width: `${Math.min(100, (orchData?.workload_assessment?.nurse_load_ratio || 5.7) * 12)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-navy-muted">
                Calculated from waiting queue + occupied treatment beds divided by active nurses ({operationalState.available_nurses} RNs).
              </p>
            </div>

            {/* PHYSICIAN WORKLOAD */}
            <div className="rounded-md border border-border bg-bg p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy">Physician Load Ratio</span>
                <span className="font-mono font-bold text-navy">
                  {orchData?.workload_assessment?.doctor_load_ratio ?? 4.8} waiting pts / MD
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-blue transition-all"
                  style={{ width: `${Math.min(100, (orchData?.workload_assessment?.doctor_load_ratio || 4.8) * 15)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-navy-muted">
                Calculated from unassigned waiting queue divided by active physicians ({operationalState.available_doctors} MDs).
              </p>
            </div>

            {/* BED OCCUPANCY */}
            <div className="rounded-md border border-border bg-bg p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-navy">Bed Capacity Utilization</span>
                <span className="font-mono font-bold text-navy">
                  {operationalState.occupancy_percent}% occupied ({operationalState.available_beds} beds available)
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-teal transition-all"
                  style={{ width: `${operationalState.occupancy_percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11.5px] text-navy-muted">
                Direct telemetry output from bed management system.
              </p>
            </div>
          </div>
        </PageCard>

        {/* 5. ACTION QUEUE */}
        <PageCard
          title="Department Action Queue"
          subtitle="Prioritized operational task management and state tracking for ER command staff"
          icon={SlidersHorizontal}
        >
          <div className="flex flex-col gap-3">
            {/* OPERATIONAL SUMMARY METRICS */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-md border border-border bg-bg p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-navy-soft block">Open Actions</span>
                <span className="font-mono text-xl font-bold text-navy">
                  {actionQueueData?.summary?.open_actions ?? 0}
                </span>
              </div>
              <div className="rounded-md border border-border bg-bg p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red block">High Priority</span>
                <span className="font-mono text-xl font-bold text-red">
                  {actionQueueData?.summary?.high_priority ?? 0}
                </span>
              </div>
              <div className="rounded-md border border-border bg-bg p-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green block">Completed</span>
                <span className="font-mono text-xl font-bold text-green">
                  {actionQueueData?.summary?.completed ?? 0}
                </span>
              </div>
            </div>

            {/* FILTERING TABS */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2.5 pt-1 text-[11px]">
              {["ALL", "HIGH PRIORITY", "NEW", "ACKNOWLEDGED", "COMPLETED"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleFilterChange(tab)}
                  className={`rounded-md px-2.5 py-1 font-bold transition-all ${
                    actionFilter === tab
                      ? "bg-navy text-white shadow-soft"
                      : "border border-border bg-bg text-navy-soft hover:bg-surface hover:text-navy"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ACTION QUEUE LIST */}
            {actionLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-[12.5px] text-navy-soft">
                <Loader2 className="h-4 w-4 animate-spin text-blue" />
                <span>Loading Action Queue items...</span>
              </div>
            ) : !actionQueueData?.actions || actionQueueData.actions.length === 0 ? (
              <div className="text-[12.5px] text-navy-muted text-center py-6">
                No action items match filter <code className="font-mono font-semibold">{actionFilter}</code>.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1">
                {actionQueueData.actions.map((item) => {
                  const statusToneMap = {
                    NEW: "blue",
                    ACKNOWLEDGED: "amber",
                    MONITORING: "teal",
                    COMPLETED: "green",
                  };

                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col gap-2 rounded-md border p-3 text-[12.5px] shadow-soft transition-all ${
                        item.status === "COMPLETED"
                          ? "border-border bg-bg/50 opacity-75"
                          : item.priority === "CRITICAL"
                          ? "border-red/30 bg-red-tint/10"
                          : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge label={item.priority} tone={item.priority === "CRITICAL" || item.priority === "HIGH" ? "red" : "amber"} />
                          <span className="font-mono text-[10.5px] font-bold uppercase text-navy-soft">
                            {item.category}
                          </span>
                        </div>
                        <StatusBadge label={item.status} tone={statusToneMap[item.status] || "blue"} />
                      </div>

                      <div>
                        <h4 className="font-bold text-navy text-[13.5px] leading-snug">{item.title}</h4>
                        <p className="mt-0.5 text-[12px] text-navy-soft leading-relaxed">{item.recommendation}</p>
                      </div>

                      {/* METADATA & CONTRIBUTING FACTORS */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-navy-muted border-t border-border/40 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-semibold text-navy-soft">Due: {item.due_time}</span>
                          <span>•</span>
                          <span className="font-sans font-medium text-navy-soft">Source: {item.source_prediction}</span>
                        </div>

                        {/* WORKFLOW ACTION BUTTONS */}
                        <div className="flex items-center gap-1.5">
                          {item.status === "NEW" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateActionStatus(item.id, "ACKNOWLEDGED")}
                                className="rounded border border-amber/40 bg-amber-tint px-2 py-0.5 text-[11px] font-bold text-amber-dark hover:bg-amber/20"
                              >
                                [Acknowledge]
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateActionStatus(item.id, "MONITORING")}
                                className="rounded border border-teal/40 bg-teal-tint px-2 py-0.5 text-[11px] font-bold text-teal-dark hover:bg-teal/20"
                              >
                                [Start Monitoring]
                              </button>
                            </>
                          )}

                          {item.status === "ACKNOWLEDGED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateActionStatus(item.id, "MONITORING")}
                                className="rounded border border-teal/40 bg-teal-tint px-2 py-0.5 text-[11px] font-bold text-teal-dark hover:bg-teal/20"
                              >
                                [Start Monitoring]
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateActionStatus(item.id, "COMPLETED")}
                                className="rounded border border-green/40 bg-green-tint px-2 py-0.5 text-[11px] font-bold text-green hover:bg-green/20"
                              >
                                [Mark Complete]
                              </button>
                            </>
                          )}

                          {item.status === "MONITORING" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateActionStatus(item.id, "COMPLETED")}
                              className="rounded border border-green/40 bg-green-tint px-2 py-0.5 text-[11px] font-bold text-green hover:bg-green/20"
                            >
                              [Mark Complete]
                            </button>
                          )}

                          {item.status === "COMPLETED" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateActionStatus(item.id, "NEW")}
                              className="rounded border border-border bg-bg px-2 py-0.5 text-[11px] font-bold text-navy-soft hover:bg-surface hover:text-navy"
                            >
                              [Re-open Action]
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-[11px] text-navy-soft italic border-t border-border pt-2">
              Operational Task System Only: Manages department-level workflow tasks. Does NOT modify patient medical records or create patient-specific treatment actions.
            </p>
          </div>
        </PageCard>
      </div>

      {/* 6. WHY IS THIS HAPPENING? (EXPLANATION MODAL) */}
      {activeWhyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-5 shadow-lift my-8">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue shrink-0" />
                <div>
                  <h3 className="text-[16px] font-bold text-navy">
                    Why was this operational recommendation generated?
                  </h3>
                  <span className="font-mono text-[11px] font-semibold text-navy-soft uppercase">
                    {activeWhyModal.category} · {activeWhyModal.priority} PRIORITY
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWhyModal(null)}
                className="rounded-md p-1 text-navy-soft hover:bg-bg hover:text-navy"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h4 className="text-[14.5px] font-bold text-navy mb-3 leading-snug">
              {activeWhyModal.title}
            </h4>

            {/* 6-QUESTION STRUCTURED XAI BREAKDOWN */}
            <div className="flex flex-col gap-3.5 text-[12.5px] leading-relaxed">
              {/* 1. WHY DETECTED */}
              <div className="rounded-md border border-border bg-bg p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue block mb-1">
                  1. Detection Rationale (Why Detected?)
                </span>
                <p className="text-navy font-medium">
                  {activeWhyModal.explanation_detail?.detection_rationale ||
                    `Associated telemetry indicates ${activeWhyModal.reason}`}
                </p>
              </div>

              {/* 2. CONTRIBUTING FACTORS */}
              <div className="rounded-md border border-border bg-bg p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue block mb-1.5">
                  2. Contributing Factors
                </span>
                <div className="flex flex-col gap-1.5">
                  {(activeWhyModal.explanation_detail?.contributing_factors || activeWhyModal.contributing_factors || []).map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded bg-surface p-2 text-[12px] border border-border">
                      <span className="font-semibold text-navy">{factor.name}</span>
                      <span className="font-mono font-bold text-amber-dark">{factor.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. STRONGEST INFLUENCE */}
              <div className="rounded-md border border-border bg-bg p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue block mb-1">
                  3. Strongest Influencing Feature
                </span>
                <p className="text-navy font-medium">
                  {activeWhyModal.explanation_detail?.strongest_influencer ||
                    `Feature attribution indicates '${activeWhyModal.contributing_factors?.[0]?.name || "Operational Telemetry"}' has the highest relative weight.`}
                </p>
              </div>

              {/* 4. TRIGGERING PREDICTION */}
              <div className="rounded-md border border-border bg-bg p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue block mb-1">
                  4. Triggering Prediction Model
                </span>
                <p className="text-navy font-medium">
                  {activeWhyModal.explanation_detail?.triggering_prediction ||
                    `Multi-model inference engine evaluation output.`}
                </p>
              </div>

              {/* 5. EXPECTED OPERATIONAL CONDITION */}
              <div className="rounded-md border border-border bg-bg p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue block mb-1">
                  5. Expected Operational Condition
                </span>
                <p className="text-navy font-medium">
                  {activeWhyModal.explanation_detail?.expected_operational_condition ||
                    `Continued capacity pressure is projected unless resource reallocation protocols are initiated.`}
                </p>
              </div>

              {/* 6. STAFF REVIEW GUIDANCE */}
              <div className="rounded-md border border-blue/20 bg-blue-tint/50 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-dark block mb-1">
                  6. What Should Staff Review?
                </span>
                <p className="text-navy-dark font-medium">
                  {activeWhyModal.explanation_detail?.staff_review_guidance ||
                    `Command staff should review bed turnover velocity, triage screening staffing, and float pool nurse availability.`}
                </p>
              </div>
            </div>

            {/* NON-CAUSAL SAFETY DISCLAIMER */}
            <p className="mt-3 text-[11px] text-navy-soft italic border-t border-border pt-2">
              Note: {activeWhyModal.explanation_detail?.disclaimer || "Non-causal model attribution: Feature attributions indicate statistical associations in department telemetry and do not imply direct clinical causality."}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11.5px] text-navy-muted">
              <span>Model Confidence: <strong className="text-navy">{activeWhyModal.confidence}</strong></span>
              <button
                type="button"
                onClick={() => setActiveWhyModal(null)}
                className="rounded-md bg-navy px-4 py-1.5 font-semibold text-white hover:bg-navy-muted"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAFETY DISCLAIMER */}
      <div className="rounded-lg border border-border bg-bg p-4 text-[12px] text-navy-soft flex items-start gap-2.5">
        <Info className="h-4 w-4 text-blue shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-navy">Operational Decision Support Disclaimer:</strong> ERFlow provides operational decision support. Recommendations do not replace clinical judgment, hospital protocols, or emergency care procedures.
        </p>
      </div>
    </div>
  );
}
