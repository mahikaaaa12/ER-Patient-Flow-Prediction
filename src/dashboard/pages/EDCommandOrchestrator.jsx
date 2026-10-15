import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Filter,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
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

const METRIC_LABELS = {
  occupancy_percent: { label: "Bed Occupancy", unit: "%" },
  available_beds: { label: "Available Beds", unit: "beds" },
  patients_waiting: { label: "Patients Waiting", unit: "pts" },
  arrival_rate: { label: "Arrival Velocity", unit: "pts/hr" },
  waiting_time_minutes: { label: "Predicted Wait Time", unit: "min" },
  predicted_peak_rate: { label: "Predicted Peak Inflow", unit: "pts/hr" },
  crowding_score: { label: "Crowding Risk Score", unit: "/100" },
  doctor_load_ratio: { label: "Physician Load", unit: "pts/MD" },
  nurse_load_ratio: { label: "Nurse Load", unit: "pts/RN" },
  available_doctors: { label: "Active Doctors", unit: "MD" },
  available_nurses: { label: "Active Nurses", unit: "RN" },
  severity_level: { label: "Acuity Level", unit: "ESI" },
  surge_score: { label: "Surge Index", unit: "/100" },
  bottleneck_stage: { label: "Bottleneck Stage", unit: "" },
};

function formatContributingMetric(key, value) {
  const meta = METRIC_LABELS[key] || {
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    unit: "",
  };
  let displayVal = value;
  if (typeof value === "number") {
    displayVal = Number.isInteger(value) ? value : value.toFixed(1);
  } else if (typeof value === "boolean") {
    displayVal = value ? "Yes" : "No";
  }
  return {
    label: meta.label,
    formattedValue: meta.unit ? `${displayVal} ${meta.unit}` : `${displayVal}`,
  };
}

const PRIORITY_STYLES = {
  CRITICAL: {
    label: "CRITICAL PRIORITY",
    border: "border-red/40",
    bg: "bg-red-tint/20",
    badgeTone: "red",
    icon: AlertTriangle,
    iconColor: "text-red",
    badgeText: "CRITICAL",
  },
  HIGH: {
    label: "HIGH PRIORITY",
    border: "border-amber/40",
    bg: "bg-amber-tint/20",
    badgeTone: "amber",
    icon: AlertCircle,
    iconColor: "text-amber-dark",
    badgeText: "HIGH",
  },
  MODERATE: {
    label: "MODERATE PRIORITY",
    border: "border-blue/30",
    bg: "bg-blue-tint/20",
    badgeTone: "blue",
    icon: Activity,
    iconColor: "text-blue",
    badgeText: "MODERATE",
  },
  LOW: {
    label: "ROUTINE MONITORING",
    border: "border-border",
    bg: "bg-surface",
    badgeTone: "green",
    icon: CheckCircle2,
    iconColor: "text-green",
    badgeText: "ROUTINE",
  },
};

const TREND_CONFIG = {
  ESCALATING: {
    label: "ESCALATING",
    badgeClass: "border-red/40 bg-red-tint text-red",
    icon: TrendingUp,
  },
  DE_ESCALATING: {
    label: "DE-ESCALATING",
    badgeClass: "border-teal/40 bg-teal-tint text-teal-dark",
    icon: TrendingDown,
  },
  RECOVERY_PENDING: {
    label: "RECOVERY PENDING",
    badgeClass: "border-amber/40 bg-amber-tint text-amber-dark",
    icon: Clock,
  },
  RECURRENCE: {
    label: "RECURRENCE",
    badgeClass: "border-purple-300 bg-purple-50 text-purple-700",
    icon: RefreshCw,
  },
  NEW: {
    label: "NEW",
    badgeClass: "border-blue/30 bg-blue-tint text-blue",
    icon: Sparkles,
  },
  STABLE: {
    label: "STABLE",
    badgeClass: "border-border bg-bg text-navy-soft",
    icon: Check,
  },
};

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

const ACKNOWLEDGEMENT_OPTIONS = [
  { id: "planned", label: "Action Planned", description: "Intervention scheduled for immediate operational execution." },
  { id: "in_progress", label: "Action In Progress", description: "Resources deployed and actively resolving bottleneck." },
  { id: "escalated", label: "Escalated to Supervisor", description: "Transferred to bed command / charge nurse for elevated action." },
  { id: "reviewed_no_action", label: "Reviewed — No Action Required", description: "Evaluated by staff; current operational baseline acceptable." },
];

function formatAckTime(timeStr) {
  if (!timeStr) return "";
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

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

  // ACKNOWLEDGEMENT MODAL & TOAST STATE
  const [activeAckModal, setActiveAckModal] = useState(null);
  const [ackResponseOption, setAckResponseOption] = useState("Action Planned");
  const [ackNotes, setAckNotes] = useState("");
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [ackError, setAckError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // RESOLUTION MODAL STATE
  const [activeResolveModal, setActiveResolveModal] = useState(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  // ACTION QUEUE STATE
  const [actionFilter, setActionFilter] = useState("ALL");
  const [actionQueueData, setActionQueueData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatuses, setActionStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem("erflow_action_statuses") || sessionStorage.getItem("erflow_action_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // RECOMMENDATION FILTERS & EVIDENCE STATE
  const [expandedEvidence, setExpandedEvidence] = useState({});
  const [recSeverityFilter, setRecSeverityFilter] = useState("ALL");
  const [recStatusFilter, setRecStatusFilter] = useState("ALL");

  const toggleEvidence = (id) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };


  // Refs for tracking input snapshot comparison and preventing race conditions
  const prevInputSignatureRef = useRef("");
  const activeRequestIdRef = useRef(0);
  const isCalculatingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getInputSignature = (state, isReal, preds = predictions) => {
    if (!state) return "";
    const predSig = preds ? [
      preds.request_id || "",
      preds.forecast?.predicted_peak_rate || "",
      preds.forecast?.trend || "",
      preds.waiting_time?.waiting_time_minutes || "",
      preds.crowding_risk?.crowding_score || "",
      preds.surge_detection?.is_surge || "",
      preds.flow_pattern?.dominant_pattern || "",
    ].join(":") : "no_preds";

    return [
      state.occupancy_percent ?? 78,
      state.patients_waiting ?? 24,
      state.arrival_rate ?? 28,
      state.available_beds ?? 8,
      state.available_doctors ?? 5,
      state.available_nurses ?? 9,
      state.severity_level ?? 3.0,
      isReal ? "real" : "demo",
      predSig,
    ].join("|");
  };

  // Fetch Action Queue from API or build fallback
  const fetchActionQueue = async (filter = actionFilter, currentOrchData = orchData) => {
    if (!isMountedRef.current) return;
    setActionLoading(true);
    try {
      if (isRealMode) {
        // Fetch persisted action queue using GET request without triggering ML calculation
        const res = await erflowApi.getActionQueue(null, filter);
        if (!isMountedRef.current) return;
        setActionQueueData(res);
        if (res?.actions) {
          setActionStatuses((prev) => {
            const next = { ...prev };
            let hasChanges = false;
            res.actions.forEach((act) => {
              if (act.status === "ACKNOWLEDGED" || act.status === "COMPLETED" || act.status === "MONITORING") {
                const existing = next[act.id];
                if (
                  !existing ||
                  existing.status !== act.status ||
                  existing.response_option !== act.response_option ||
                  existing.notes !== act.notes
                ) {
                  hasChanges = true;
                  next[act.id] = {
                    status: act.status,
                    response_option: act.response_option || "Action Planned",
                    notes: act.notes || "",
                    acknowledged_at: act.acknowledged_at || act.created_at,
                  };
                }
              }
            });
            if (!hasChanges) {
              return prev; // Avoid triggering re-render if queue statuses are unchanged
            }
            try {
              localStorage.setItem("erflow_action_statuses", JSON.stringify(next));
              sessionStorage.setItem("erflow_action_statuses", JSON.stringify(next));
            } catch (e) {
              console.warn("Failed to persist action status in storage:", e);
            }
            return next;
          });
        }
      } else {
        const actions = (currentOrchData?.recommended_actions || []).map((rec) => {
          const statusRec = actionStatuses[rec.id];
          const status = typeof statusRec === "object" ? statusRec.status : (statusRec || "NEW");
          return {
            id: rec.id,
            category: rec.category,
            title: rec.title,
            recommendation: rec.recommended_action,
            priority: rec.priority,
            created_at: rec.timestamp || new Date().toISOString(),
            due_time: `In ${rec.due_in_minutes || 30} mins`,
            status: status,
            response_option: typeof statusRec === "object" ? statusRec.response_option : undefined,
            notes: typeof statusRec === "object" ? statusRec.notes : undefined,
            acknowledged_at: typeof statusRec === "object" ? statusRec.acknowledged_at : undefined,
            contributing_factors: rec.contributing_factors?.map(f => typeof f === "string" ? f : f.name) || ["Telemetry Load"],
            source_prediction: rec.source_prediction || (rec.category === "BED CAPACITY" ? "Supervised XGBoost Classifier (Crowding Risk)" : "Supervised XGBoost Regressor (Wait Time)"),
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

  // Run Orchestrator Evaluation strictly ONCE when meaningful input snapshot or predictions change
  const runOrchestratorEvaluation = async (manual = false) => {
    if (!isMountedRef.current) return;

    // Request lifecycle: if centralized predictions are actively computing/updating,
    // wait until they resolve so we evaluate recommendations with matching predictions
    if (erLoading && !manual) {
      console.log("[ORCHESTRATOR] Centralized predictions in-flight → deferring evaluation until predictions arrive");
      return;
    }

    const currentSig = getInputSignature(operationalState, isRealMode, predictions);

    // Guard: skip if signature unchanged and we already have results (non-manual)
    if (!manual && currentSig === prevInputSignatureRef.current && orchData) {
      console.log("[ORCHESTRATOR] Input and prediction snapshot unchanged → skipping calculation");
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
      console.log("[ORCHESTRATOR] Input or prediction snapshot changed → calculation started");
    }

    prevInputSignatureRef.current = currentSig;
    const reqId = ++activeRequestIdRef.current;
    isCalculatingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      let resData = null;
      const payload = {
        hospital_state: operationalState,
        predictions: predictions || undefined,
      };

      if (isRealMode) {
        console.log("[ORCHESTRATOR] API Call: POST /api/orchestrator/analyze with centralized predictions", payload);
        resData = await erflowApi.getOrchestratorAnalysis(payload);
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
              severity: waiting > 20 ? "HIGH" : "MODERATE",
              title: "Review Triage Staffing for Upcoming Demand",
              description: "Queue pressure is increasing in initial screening and triage intake.",
              recommended_action: "Assign auxiliary triage screening nurse and open fast-track intake bay.",
              recommended_actions: [
                "Assign auxiliary triage screening nurse and open fast-track intake bay.",
                "Activate fast-track screening protocol for low-acuity arrivals (ESI 4-5).",
                "Notify clinical lead of projected waiting queue growth over the next 2 hours."
              ],
              contributing_metrics: {
                patients_waiting: waiting,
                arrival_rate: arrRate,
                doctor_load_ratio: docRatio,
                waiting_time_minutes: Math.round(waiting * 2.2),
              },
              urgency: "WITHIN 30 MIN",
              due_in_minutes: 30,
              contributing_factors: [
                { name: "Patients Waiting", impact: "increases_pressure", contribution_score: waiting, detail: `${waiting} patients waiting in queue` },
                { name: "Arrival Velocity", impact: "increases_pressure", contribution_score: arrRate, detail: `${arrRate} arrivals per hour` },
                { name: "Predicted Demand", impact: "increases_pressure", contribution_score: arrRate * 2.4, detail: "LSTM projects rising inflow" },
              ],
              reason: "Queue length and arrival velocity indicate rising triage bottleneck.",
              rule_id: "RULE_TRIAGE_BOTTLENECK",
              rule_explanation: "Triggered when patients waiting exceed 20 and arrival rate exceeds 25 pts/hr.",
              forecast_horizon: "1h-3h Horizon",
              priority_score: waiting > 20 ? 84.5 : 62.0,
              model_confidence: 0.88,
              issue_trend: waiting > 25 ? "ESCALATING" : "NEW",
              escalation_detected: waiting > 25,
              required_resources: ["Auxiliary Triage RN", "Intake Bay 2"],
              required_approvals: ["Triage Charge Nurse Approval"],
              source_prediction: "Supervised XGBoost Regressor (Wait Time)",
              confidence: "HIGH",
              requires_human_review: true,
              explanation_detail: {
                detection_rationale: "Queue length and arrival velocity indicate rising intake strain at triage screening.",
                contributing_factors: [
                  { name: "Patients Waiting", impact: "increases_pressure", contribution_score: waiting, detail: `${waiting} patients waiting in queue` },
                  { name: "Arrival Velocity", impact: "increases_pressure", contribution_score: arrRate, detail: `${arrRate} arrivals per hour` },
                ],
                strongest_influencer: "Patients Waiting (Queue Length)",
                triggering_prediction: "Wait Time Regressor projected wait time increase of 35%",
                expected_operational_condition: "Intake backlog will delay initial physician exam unless secondary intake nurse is deployed.",
                staff_review_guidance: "Evaluate waiting room acuity and assign float nurse to fast-track intake.",
                disclaimer: "Non-causal model attribution: Feature attributions indicate statistical associations in department telemetry and do not imply direct clinical causality."
              }
            },
            {
              id: "rec-bed-capacity",
              category: "BED CAPACITY",
              priority: occ > 80 ? "HIGH" : "MODERATE",
              severity: occ > 80 ? "HIGH" : "MODERATE",
              title: "Initiate Accelerated Inpatient Bed Transfers",
              description: `ED bed occupancy is at ${occ}% capacity with ${beds} available beds remaining.`,
              recommended_action: "Coordinate with hospital bed command to expedite pending inpatient admissions.",
              recommended_actions: [
                "Coordinate with hospital bed command to expedite pending inpatient admissions.",
                "Prepare surge flex beds in step-down observation unit.",
                "Accelerate clinical discharge paperwork for stable observation patients."
              ],
              contributing_metrics: {
                occupancy_percent: occ,
                available_beds: beds,
                nurse_load_ratio: nurseRatio,
                crowding_score: Math.min(100, Math.round(occ * 0.85 + (waiting / 2))),
              },
              urgency: "WITHIN 30 MIN",
              due_in_minutes: 25,
              contributing_factors: [
                { name: "Occupancy Percent", impact: "increases_pressure", contribution_score: occ, detail: `${occ}% capacity utilized` },
                { name: "Available Beds", impact: "increases_pressure", contribution_score: beds, detail: `Only ${beds} beds available` },
              ],
              reason: "High bed occupancy reduces treatment bay turnover for new arrivals.",
              rule_id: "RULE_BED_CAPACITY_STRAIN",
              rule_explanation: "Triggered when department occupancy exceeds 75% or available staffed beds fall below 10.",
              forecast_horizon: "30m-2h Horizon",
              priority_score: occ > 80 ? 89.0 : 68.0,
              model_confidence: 0.91,
              issue_trend: occ > 85 ? "ESCALATING" : "STABLE",
              escalation_detected: occ > 85,
              required_resources: ["Bed Command Coordinator", "Patient Transport Team"],
              required_approvals: ["Floor Medical Director Authorization"],
              source_prediction: "Supervised XGBoost Classifier (Crowding Risk)",
              confidence: "HIGH",
              requires_human_review: true,
              explanation_detail: {
                detection_rationale: "High bed occupancy reduces treatment bay turnover for incoming acute arrivals.",
                contributing_factors: [
                  { name: "Occupancy Percent", impact: "increases_pressure", contribution_score: occ, detail: `${occ}% capacity utilized` },
                  { name: "Available Beds", impact: "increases_pressure", contribution_score: beds, detail: `Only ${beds} beds available` },
                ],
                strongest_influencer: "Occupancy Percent",
                triggering_prediction: "Crowding Risk Classifier indicates elevated risk of boarding gridlock",
                expected_operational_condition: "Admitted patients will board in ED treatment bays without expedited floor transfers.",
                staff_review_guidance: "Contact central hospital bed placement for urgent inpatient room assignment.",
                disclaimer: "Non-causal model attribution: Feature attributions indicate statistical associations in department telemetry and do not imply direct clinical causality."
              }
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

      if (isMountedRef.current && reqId === activeRequestIdRef.current) {
        setOrchData(resData);
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastEvaluatedTime(now);
        console.log("[ORCHESTRATOR] Calculation completed successfully");
      } else {
        console.log(`[ORCHESTRATOR] Discarding outdated evaluation response #${reqId} (active is #${activeRequestIdRef.current})`);
      }
    } catch (err) {
      if (isMountedRef.current && reqId === activeRequestIdRef.current) {
        console.warn("Orchestrator API call failed:", err.message);
        setError(err.message || "Failed to retrieve orchestrator analysis");
      }
    } finally {
      if (reqId === activeRequestIdRef.current) {
        isCalculatingRef.current = false;
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }
  };

  // Evaluation triggered ONLY when operational input snapshot or predictions change
  useEffect(() => {
    runOrchestratorEvaluation();
  }, [
    isRealMode,
    erLoading,
    operationalState?.occupancy_percent,
    operationalState?.patients_waiting,
    operationalState?.arrival_rate,
    operationalState?.available_beds,
    operationalState?.available_doctors,
    operationalState?.available_nurses,
    operationalState?.severity_level,
    predictions?.request_id,
    predictions?.waiting_time?.waiting_time_minutes,
    predictions?.crowding_risk?.crowding_score,
    predictions?.forecast?.predicted_peak_rate,
    predictions?.surge_detection?.is_surge,
    predictions?.flow_pattern?.dominant_pattern,
  ]);

  // Initial sync from backend persistent store on mount
  useEffect(() => {
    fetchActionQueue();
  }, []);

  useEffect(() => {
    if (orchData) {
      fetchActionQueue(actionFilter, orchData);
    }
  }, [orchData, actionFilter, isRealMode]);


  // ACKNOWLEDGEMENT MODAL HANDLERS
  const handleOpenAcknowledgeModal = (rec) => {
    const existing = actionStatuses[rec.id];
    if (typeof existing === "object" && existing.response_option) {
      setAckResponseOption(existing.response_option);
      setAckNotes(existing.notes || "");
    } else {
      setAckResponseOption("Action Planned");
      setAckNotes("");
    }
    setAckError(null);
    setAckSubmitting(false);
    setActiveAckModal(rec);
  };

  const handleConfirmAcknowledgement = async () => {
    if (!activeAckModal || ackSubmitting) return;

    setAckSubmitting(true);
    setAckError(null);

    const nowIso = new Date().toISOString();
    const ackRecord = {
      status: "ACKNOWLEDGED",
      response_option: ackResponseOption,
      notes: ackNotes.trim(),
      acknowledged_at: nowIso,
      priority: activeAckModal.priority,
    };

    try {
      if (isRealMode) {
        await erflowApi.updateActionStatus(activeAckModal.id, "ACKNOWLEDGED", {
          response_option: ackResponseOption,
          notes: ackNotes.trim(),
          acknowledged_at: nowIso,
          title: activeAckModal.title,
          category: activeAckModal.category,
          recommendation: activeAckModal.recommended_action || activeAckModal.recommended_actions?.[0],
          priority: activeAckModal.priority,
        });
      }

      const updated = {
        ...actionStatuses,
        [activeAckModal.id]: ackRecord,
      };

      setActionStatuses(updated);
      try {
        sessionStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
        localStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to persist action status in storage:", e);
      }

      fetchActionQueue(actionFilter);

      setToastMessage("Operational recommendation acknowledged successfully.");
      setActiveAckModal(null);
    } catch (err) {
      console.error("Failed to save acknowledgement:", err);
      setAckError(err.message || "Failed to persist acknowledgement to server. Please verify network and try again.");
    } finally {
      setAckSubmitting(false);
    }
  };

  // RESOLUTION MODAL HANDLERS
  const handleOpenResolveModal = (rec) => {
    setActiveResolveModal(rec);
    setResolveNotes("");
    setResolveError(null);
    setResolveSubmitting(false);
  };

  const handleConfirmResolution = async () => {
    if (!activeResolveModal || resolveSubmitting) return;

    setResolveSubmitting(true);
    setResolveError(null);

    const nowIso = new Date().toISOString();
    const resolutionText = resolveNotes.trim() || "Operational bottleneck resolved by hospital command staff.";

    try {
      if (isRealMode) {
        await erflowApi.updateActionStatus(activeResolveModal.id, "COMPLETED", {
          resolution_notes: resolutionText,
          resolved_at: nowIso,
          status: "COMPLETED",
          title: activeResolveModal.title,
          category: activeResolveModal.category,
          recommendation: activeResolveModal.recommended_action || activeResolveModal.recommended_actions?.[0],
          priority: activeResolveModal.priority,
        });
      }

      const existingRecord = actionStatuses[activeResolveModal.id] || {};
      const updatedRecord = {
        ...existingRecord,
        status: "COMPLETED",
        resolved_at: nowIso,
        resolution_notes: resolutionText,
      };

      const updated = {
        ...actionStatuses,
        [activeResolveModal.id]: updatedRecord,
      };

      setActionStatuses(updated);
      try {
        localStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
        sessionStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to persist resolution status in storage:", e);
      }

      fetchActionQueue(actionFilter);
      setToastMessage("Operational issue successfully marked as resolved.");
      setActiveResolveModal(null);
    } catch (err) {
      console.error("Failed to mark issue as resolved:", err);
      setResolveError(err.message || "Failed to mark issue as resolved. Please try again.");
    } finally {
      setResolveSubmitting(false);
    }
  };

  const handleUpdateActionStatus = async (actionId, newStatus, extraData = {}) => {
    const prevStatusObj = actionStatuses[actionId];
    const updatedStatusObj = typeof prevStatusObj === "object"
      ? { ...prevStatusObj, status: newStatus, ...extraData }
      : { status: newStatus, response_option: "Action Planned", acknowledged_at: new Date().toISOString(), ...extraData };

    const updated = { ...actionStatuses, [actionId]: updatedStatusObj };
    setActionStatuses(updated);
    try {
      sessionStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
      localStorage.setItem("erflow_action_statuses", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist action status in session:", e);
    }

    if (isRealMode) {
      try {
        await erflowApi.updateActionStatus(actionId, newStatus, extraData);
      } catch (err) {
        console.warn("Error updating action status via API:", err.message);
      }
    }
    fetchActionQueue(actionFilter);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (activeAckModal && !ackSubmitting) {
          setActiveAckModal(null);
        } else if (activeResolveModal && !resolveSubmitting) {
          setActiveResolveModal(null);
        } else if (activeWhyModal) {
          setActiveWhyModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAckModal, activeResolveModal, activeWhyModal, ackSubmitting, resolveSubmitting]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);


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

      {/* 2. PRIORITIZED OPERATIONAL ACTION LIST */}
      {(() => {
        const isAckRecord = (id) => {
          const rec = actionStatuses[id];
          return typeof rec === "object"
            ? rec?.status === "ACKNOWLEDGED" || rec?.status === "COMPLETED"
            : rec === "ACKNOWLEDGED" || rec === "COMPLETED";
        };

        const sortedRecs = (orchData?.recommended_actions || []).slice().sort((a, b) => {
          const pA = a.priority_score ?? (a.priority === "CRITICAL" ? 95 : a.priority === "HIGH" ? 75 : a.priority === "MODERATE" ? 50 : 25);
          const pB = b.priority_score ?? (b.priority === "CRITICAL" ? 95 : b.priority === "HIGH" ? 75 : b.priority === "MODERATE" ? 50 : 25);
          if (pB !== pA) return pB - pA;
          return (a.due_in_minutes ?? 60) - (b.due_in_minutes ?? 60);
        });

        const critCount = sortedRecs.filter((r) => (r.severity || r.priority) === "CRITICAL").length;
        const highCount = sortedRecs.filter((r) => (r.severity || r.priority) === "HIGH").length;
        const routineCount = sortedRecs.filter((r) => (r.severity || r.priority) !== "CRITICAL" && (r.severity || r.priority) !== "HIGH").length;
        const ackCount = sortedRecs.filter((r) => isAckRecord(r.id)).length;
        const actionReqCount = sortedRecs.length - ackCount;

        const filteredRecs = sortedRecs.filter((rec) => {
          if (recSeverityFilter !== "ALL") {
            const sev = (rec.severity || rec.priority || "").toUpperCase();
            if (recSeverityFilter === "CRITICAL" && sev !== "CRITICAL") return false;
            if (recSeverityFilter === "HIGH" && sev !== "HIGH") return false;
            if (recSeverityFilter === "ROUTINE" && (sev === "CRITICAL" || sev === "HIGH")) return false;
          }
          if (recStatusFilter !== "ALL") {
            const ack = isAckRecord(rec.id);
            if (recStatusFilter === "ACKNOWLEDGED" && !ack) return false;
            if (recStatusFilter === "ACTION_REQUIRED" && ack) return false;
          }
          return true;
        });

        const engineStatus = orchData?.ml_engine_status || {};
        const isDegraded =
          orchData?.degraded_mode ||
          Object.values(engineStatus).some((st) => st && st !== "online" && st !== "demo");

        return (
          <PageCard
            title="Prioritized Operational Action List"
            subtitle="Live ML-driven recommendations ranked by operational severity, expected bottleneck window, and multi-factor telemetry signals"
            icon={AlertTriangle}
            action={
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-navy-soft">
                <span>Total: <strong className="text-navy">{sortedRecs.length}</strong></span>
                <span>•</span>
                <span className="text-red font-bold">Crit: {critCount}</span>
                <span>•</span>
                <span className="text-amber-dark font-bold">High: {highCount}</span>
              </div>
            }
          >
            {/* FILTER TOOLBAR & CONTROL ROW */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft mr-1">
                  Severity:
                </span>
                <button
                  type="button"
                  onClick={() => setRecSeverityFilter("ALL")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recSeverityFilter === "ALL"
                      ? "bg-navy text-white shadow-soft"
                      : "border border-border bg-bg text-navy-soft hover:bg-surface hover:text-navy"
                  }`}
                >
                  ALL ({sortedRecs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRecSeverityFilter("CRITICAL")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recSeverityFilter === "CRITICAL"
                      ? "bg-red text-white shadow-soft"
                      : "border border-red/30 bg-red-tint/30 text-red hover:bg-red-tint"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  CRITICAL ({critCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRecSeverityFilter("HIGH")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recSeverityFilter === "HIGH"
                      ? "bg-amber text-white shadow-soft"
                      : "border border-amber/30 bg-amber-tint/30 text-amber-dark hover:bg-amber-tint"
                  }`}
                >
                  <AlertCircle className="h-3 w-3" />
                  HIGH ({highCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRecSeverityFilter("ROUTINE")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recSeverityFilter === "ROUTINE"
                      ? "bg-teal-dark text-white shadow-soft"
                      : "border border-border bg-bg text-navy-soft hover:bg-surface hover:text-navy"
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  ROUTINE ({routineCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft mr-1">
                  Status:
                </span>
                <button
                  type="button"
                  onClick={() => setRecStatusFilter("ALL")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recStatusFilter === "ALL"
                      ? "bg-navy text-white shadow-soft"
                      : "border border-border bg-bg text-navy-soft hover:bg-surface hover:text-navy"
                  }`}
                >
                  ALL
                </button>
                <button
                  type="button"
                  onClick={() => setRecStatusFilter("ACTION_REQUIRED")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recStatusFilter === "ACTION_REQUIRED"
                      ? "bg-blue text-white shadow-soft"
                      : "border border-blue/30 bg-blue-tint/30 text-blue hover:bg-blue-tint"
                  }`}
                >
                  ACTION REQUIRED ({actionReqCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRecStatusFilter("ACKNOWLEDGED")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    recStatusFilter === "ACKNOWLEDGED"
                      ? "bg-green text-white shadow-soft"
                      : "border border-green/30 bg-green-tint/30 text-green hover:bg-green-tint"
                  }`}
                >
                  <CheckCheck className="h-3 w-3" />
                  ACKNOWLEDGED ({ackCount})
                </button>
              </div>
            </div>

            {/* PARTIAL DATA / DEGRADED TELEMETRY BANNER */}
            {isDegraded && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber/40 bg-amber-tint/40 p-3 text-[12px] text-amber-dark">
                <div className="flex items-start sm:items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold">Partial ML Engine Telemetry: </span>
                    <span>
                      Operational recommendations generated using available models and telemetry. Unavailable services fallback to observed baselines; results are never fabricated.
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {Object.entries(engineStatus).map(([engine, st]) => (
                    <span
                      key={engine}
                      className={`font-mono text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        st === "online" || st === "demo"
                          ? "border-green/40 bg-green-tint text-green"
                          : "border-amber/50 bg-amber-tint text-amber-dark"
                      }`}
                    >
                      {engine}: {st}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* BACKEND ERROR STATE */}
            {error && !loading && sortedRecs.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-red/30 bg-red-tint/30 text-red mb-4">
                <AlertCircle className="h-7 w-7 text-red mb-2" />
                <h4 className="text-[14px] font-bold text-red">Operational Recommendation Service Offline</h4>
                <p className="text-[12.5px] text-navy-soft max-w-md mt-1 mb-3">
                  {error || "Unable to retrieve real-time recommendations from backend orchestrator."}
                </p>
                <button
                  type="button"
                  onClick={() => runOrchestratorEvaluation(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-soft hover:bg-red/90"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Connection
                </button>
              </div>
            )}

            {/* LOADING STATE - Only show full placeholder if no recommendations are currently loaded */}
            {(loading || erLoading) && sortedRecs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center rounded-lg border border-dashed border-border bg-bg/40">
                <Loader2 className="h-7 w-7 animate-spin text-blue mb-2.5" />
                <h4 className="text-[14px] font-bold text-navy">Evaluating Department Operational Command State...</h4>
                <p className="text-[12.5px] text-navy-soft max-w-md mt-1">
                  Synthesizing XGBoost queue predictions, crowding classification, LSTM forecasts, and hospital staffing telemetry into prioritized actions.
                </p>
              </div>
            ) : sortedRecs.length === 0 ? (
              /* EMPTY STATE (NO ACTIONS NEEDED) */
              <div className="flex items-center gap-3.5 rounded-lg border border-green/30 bg-green-tint/60 p-4.5 text-green">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-green" />
                <div>
                  <h4 className="text-[14px] font-bold text-green-dark">All Operational Baselines Stable — No Action Required</h4>
                  <p className="text-[12.5px] text-green/90 mt-0.5">
                    No urgent triage queues, bed saturation, or staffing deficits detected across active ML models. Department capacity is operating within standard safety tolerances.
                  </p>
                </div>
              </div>
            ) : filteredRecs.length === 0 ? (
              /* EMPTY STATE (FILTER MISMATCH) */
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-border bg-bg">
                <Filter className="h-6 w-6 text-navy-soft mb-2" />
                <h4 className="text-[13.5px] font-bold text-navy">No recommendations match the selected filters.</h4>
                <button
                  type="button"
                  onClick={() => {
                    setRecSeverityFilter("ALL");
                    setRecStatusFilter("ALL");
                  }}
                  className="mt-2.5 rounded-md border border-border bg-surface px-3 py-1 text-[11.5px] font-semibold text-blue hover:underline"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              /* RECOMMENDATIONS GRID (Preserved during re-evaluation with status pill) */
              <div className="space-y-3">
                {(loading || erLoading) && (
                  <div className="flex items-center gap-2 rounded-md border border-blue/30 bg-blue-tint/70 px-3.5 py-2 text-[12px] font-semibold text-blue">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-blue" />
                    <span>Recalculating operational command state... Current recommendations preserved below.</span>
                  </div>
                )}
                <div className={`grid grid-cols-1 gap-4 lg:grid-cols-2 transition-opacity duration-200 ${(loading || erLoading) ? "opacity-75" : "opacity-100"}`}>
                  {filteredRecs.map((rec) => {
                  const CategoryIcon = CATEGORY_ICONS[rec.category] || AlertTriangle;
                  const ackRecord = actionStatuses[rec.id];
                  const isAck = isAckRecord(rec.id);
                  const selectedResponse =
                    typeof ackRecord === "object" ? ackRecord?.response_option : typeof ackRecord === "string" ? ackRecord : null;
                  const ackTimestamp = typeof ackRecord === "object" ? ackRecord?.acknowledged_at : null;

                  const pStyle =
                    PRIORITY_STYLES[rec.priority] ||
                    PRIORITY_STYLES[rec.severity] ||
                    PRIORITY_STYLES.MODERATE;
                  const PriorityIcon = pStyle.icon;

                  const trendKey = (rec.issue_trend || "NEW").toUpperCase().replace(/-/g, "_");
                  const trendCfg = TREND_CONFIG[trendKey] || TREND_CONFIG.NEW;
                  const TrendIcon = trendCfg.icon;

                  const isExpanded = !!expandedEvidence[rec.id];

                  const isResolved =
                    typeof ackRecord === "object"
                      ? ackRecord?.status === "COMPLETED"
                      : ackRecord === "COMPLETED";

                  const hasConditionChanged =
                    isAck &&
                    !isResolved &&
                    (ackRecord?.condition_changed_since_ack ||
                      (ackRecord?.priority && ackRecord.priority !== rec.priority));

                  return (
                    <div
                      key={rec.id}
                      className={`flex flex-col justify-between rounded-lg border p-4 shadow-soft transition-all ${
                        isResolved
                          ? "border-green/30 bg-green-tint/10 opacity-95"
                          : isAck
                          ? "border-border bg-bg/60 opacity-95"
                          : `${pStyle.border} ${pStyle.bg}`
                      }`}
                    >
                      <div>
                        {/* CARD HEADER: CATEGORY, SEVERITY (ACCESSIBLE), PRIORITY SCORE, TREND */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <CategoryIcon className="h-4 w-4 text-blue shrink-0" />
                              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-navy">
                                {rec.category}
                              </span>
                            </div>

                            {/* ACCESSIBLE SEVERITY BADGE (ICON + EXPLICIT LABEL + BORDER) */}
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${pStyle.border} bg-surface ${pStyle.iconColor}`}
                            >
                              <PriorityIcon className="h-3 w-3 shrink-0" />
                              <span>{pStyle.label}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* PRIORITY SCORE */}
                            <span className="font-mono text-[10.5px] font-bold rounded border border-border bg-surface px-1.5 py-0.5 text-navy">
                              Score: {rec.priority_score != null ? Math.round(rec.priority_score) : 80}/100
                            </span>

                            {/* LIFECYCLE TREND BADGE */}
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${trendCfg.badgeClass}`}
                            >
                              <TrendIcon className="h-2.5 w-2.5 shrink-0" />
                              <span>
                                {trendCfg.label}
                                {rec.historical_occurrence_count > 1 ? ` (x${rec.historical_occurrence_count})` : ""}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* PROBLEM TITLE */}
                        <h3 className="text-[15px] font-bold text-navy leading-snug">
                          {rec.title}
                        </h3>

                        {/* WHY DETECTED & RULE ID */}
                        <div className="mt-2 rounded-md border border-navy/10 bg-surface/70 p-2.5 text-[12px] text-navy-soft">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-bold text-navy uppercase text-[10px] tracking-wider">
                              Why Detected:
                            </span>
                            {rec.rule_id && (
                              <span className="font-mono text-[9.5px] font-semibold text-navy-muted bg-bg px-1.5 py-0.5 rounded border border-border">
                                {rec.rule_id}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-navy leading-snug">
                            {rec.reason || rec.explanation_detail?.detection_rationale || rec.description}
                          </p>
                        </div>

                        {/* LIVE CONTRIBUTING METRICS & PREDICTION HORIZON */}
                        {rec.contributing_metrics && Object.keys(rec.contributing_metrics).length > 0 && (
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-soft">
                                Telemetry & Prediction Signals:
                              </span>
                              {rec.forecast_horizon && (
                                <span className="font-mono text-[9.5px] font-semibold text-blue-dark bg-blue-tint px-1.5 py-0.5 rounded border border-blue/20">
                                  {rec.forecast_horizon}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {Object.entries(rec.contributing_metrics).map(([key, val]) => {
                                const metric = formatContributingMetric(key, val);
                                return (
                                  <div
                                    key={key}
                                    className="flex flex-col rounded bg-surface p-1.5 border border-border text-[11px]"
                                  >
                                    <span className="text-navy-muted text-[9px] uppercase font-semibold truncate">
                                      {metric.label}
                                    </span>
                                    <span className="font-mono font-bold text-navy mt-0.5 truncate">
                                      {metric.formattedValue}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* RANKED CONCRETE ACTIONS */}
                        <div className="mt-3 rounded-md border border-blue/25 bg-blue-tint/40 p-3 text-[12px]">
                          <span className="font-bold text-blue-dark block uppercase tracking-wider text-[10.5px] mb-1.5">
                            Recommended Operational Actions:
                          </span>
                          {rec.recommended_actions && rec.recommended_actions.length > 1 ? (
                            <ol className="flex flex-col gap-1.5">
                              {rec.recommended_actions.map((act, actIdx) => (
                                <li key={actIdx} className="flex items-start gap-2 text-navy">
                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white mt-0.5">
                                    {actIdx + 1}
                                  </span>
                                  <span className="font-semibold text-navy-dark leading-snug">
                                    {act}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="font-semibold text-navy-dark leading-snug">
                              {rec.recommended_action || rec.recommended_actions?.[0]}
                            </p>
                          )}
                        </div>

                        {/* EXPANDABLE EVIDENCE & ML SIGNALS SECTION */}
                        <div className="mt-3 border-t border-border/60 pt-2.5">
                          <button
                            type="button"
                            onClick={() => toggleEvidence(rec.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-navy hover:text-blue transition-colors focus:outline-hidden"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-3.5 w-3.5 text-blue" />
                                <span>Hide Decision Evidence & Signals</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-3.5 w-3.5 text-blue" />
                                <span>
                                  View Decision Evidence & Signals ({rec.contributing_factors?.length || 0} factors)
                                </span>
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 flex flex-col gap-2.5 rounded-md border border-border bg-surface p-3 text-[11.5px] animate-in fade-in duration-150">
                              {/* TreeSHAP Feature Attributions */}
                              {rec.contributing_factors && rec.contributing_factors.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-navy-soft block mb-1">
                                    TreeSHAP Feature Attributions (Contribution Weight)
                                  </span>
                                  <div className="flex flex-col gap-1">
                                    {rec.contributing_factors.map((factor, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between rounded bg-bg p-1.5 border border-border text-[11px]"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                              factor.impact === "increases_pressure" ? "bg-red" : "bg-teal"
                                            } shrink-0`}
                                          />
                                          <span className="font-semibold text-navy">{factor.name}</span>
                                        </div>
                                        <span className="font-mono text-navy-soft">{factor.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Source Prediction & Confidence Distinction */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="rounded bg-bg p-2 border border-border">
                                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-navy-muted block">
                                    Source Prediction Engine
                                  </span>
                                  <span className="font-medium text-navy text-[11px] mt-0.5 block truncate">
                                    {rec.source_prediction || "Multi-Engine Orchestration"}
                                  </span>
                                </div>
                                <div className="rounded bg-bg p-2 border border-border">
                                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-navy-muted block">
                                    Model Confidence
                                  </span>
                                  <span className="font-medium text-navy text-[11px] mt-0.5 block">
                                    {rec.model_confidence != null
                                      ? `${Math.round(rec.model_confidence * 100)}% (Native Classifier)`
                                      : `${rec.confidence || "HIGH"} (Deterministic Rule)`}
                                  </span>
                                </div>
                              </div>

                              {/* Required Resources & Approvals */}
                              {(rec.required_resources?.length > 0 || rec.required_approvals?.length > 0) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {rec.required_resources?.length > 0 && (
                                    <div className="rounded bg-bg p-2 border border-border">
                                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-navy-muted block">
                                        Required Resources
                                      </span>
                                      <span className="font-medium text-navy text-[11px] mt-0.5 block">
                                        {rec.required_resources.join(", ")}
                                      </span>
                                    </div>
                                  )}
                                  {rec.required_approvals?.length > 0 && (
                                    <div className="rounded bg-bg p-2 border border-border">
                                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-navy-muted block">
                                        Required Authorizations
                                      </span>
                                      <span className="font-medium text-navy text-[11px] mt-0.5 block">
                                        {rec.required_approvals.join(", ")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* UNDERLYING CONDITION CHANGED WARNING */}
                      {hasConditionChanged && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-amber/40 bg-amber-tint/60 p-2.5 text-[11.5px] text-amber-dark font-medium">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber" />
                            <span>
                              Operational condition changed since acknowledgement: Severity is now{" "}
                              <strong className="uppercase">{rec.priority}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenAcknowledgeModal(rec)}
                            className="shrink-0 text-[11px] font-bold text-navy hover:underline"
                          >
                            Review & Update
                          </button>
                        </div>
                      )}

                      {/* CARD FOOTER: URGENCY, WHY?, SIMULATE, ACKNOWLEDGE / RESOLVED */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-between border-t border-border/60 pt-3 text-[12px] gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-navy-soft">
                            Due in: <strong className="text-navy">{rec.due_in_minutes} min</strong>
                          </span>
                          <span className="text-navy-muted">•</span>
                          <span className="font-mono text-[10.5px] text-navy-soft uppercase">
                            {rec.urgency}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveWhyModal(rec)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-navy hover:bg-bg hover:text-blue transition-colors"
                          >
                            <HelpCircle className="h-3.5 w-3.5 text-blue" />
                            Why?
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSimulateRecommendation(rec)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-navy hover:bg-bg hover:text-teal transition-colors"
                          >
                            <Sliders className="h-3.5 w-3.5 text-teal" />
                            Simulate
                          </button>

                          {isResolved ? (
                            <div className="flex flex-col items-end">
                              <div className="inline-flex items-center gap-1.5 rounded-md border border-green/40 bg-green-tint px-3 py-1 text-[11.5px] font-bold text-green">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green" />
                                <span>Resolved</span>
                              </div>
                              {ackRecord?.resolved_at && (
                                <span className="text-[10px] font-semibold text-navy-soft mt-0.5">
                                  Resolved {formatAckTime(ackRecord.resolved_at)}
                                </span>
                              )}
                              {ackRecord?.resolution_notes && (
                                <span className="text-[10px] italic text-navy-muted max-w-[200px] truncate text-right">
                                  "{ackRecord.resolution_notes}"
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateActionStatus(rec.id, "NEW")}
                                className="text-[9.5px] font-bold text-navy-muted hover:text-blue underline mt-0.5"
                              >
                                Reopen Issue
                              </button>
                            </div>
                          ) : isAck ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className="inline-flex items-center gap-1.5 rounded-md border border-green/40 bg-green-tint px-3 py-1 text-[11.5px] font-bold text-green">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green" />
                                  <span>Acknowledged</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenResolveModal(rec)}
                                  className="inline-flex items-center gap-1 rounded-md border border-navy/20 bg-navy px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-navy-muted transition-colors"
                                >
                                  <Check className="h-3 w-3" />
                                  Mark Resolved
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-navy-soft">
                                {selectedResponse && (
                                  <span className="font-semibold text-navy">
                                    {selectedResponse} {ackTimestamp ? `• ${formatAckTime(ackTimestamp)}` : ""}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenAcknowledgeModal(rec)}
                                  className="text-blue hover:underline font-semibold ml-1"
                                >
                                  Edit
                                </button>
                              </div>
                              {ackRecord?.notes && (
                                <span className="text-[10px] italic text-navy-muted max-w-[240px] truncate text-right">
                                  "{ackRecord.notes}"
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAcknowledgeModal(rec)}
                              className="inline-flex items-center gap-1 rounded-md bg-navy px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-soft hover:bg-navy-muted transition-all"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Acknowledge</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </PageCard>
        );
      })()}

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

      {/* ACKNOWLEDGEMENT MODAL DIALOG */}
      {activeAckModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ack-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ackSubmitting) {
              setActiveAckModal(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-elevated max-h-[90vh] overflow-y-auto">
            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue/30 bg-blue-tint text-blue">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="ack-modal-title" className="text-[15px] font-bold text-navy">
                      Acknowledge Operational Issue
                    </h3>
                    <StatusBadge
                      label={activeAckModal.priority}
                      tone={activeAckModal.priority === "CRITICAL" || activeAckModal.priority === "HIGH" ? "red" : "amber"}
                    />
                  </div>
                  <p className="text-[11.5px] font-semibold text-navy-soft uppercase tracking-wider mt-0.5">
                    Category: {activeAckModal.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !ackSubmitting && setActiveAckModal(null)}
                disabled={ackSubmitting}
                className="rounded-md p-1 text-navy-muted hover:bg-bg hover:text-navy disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ISSUE DETAILS CARD */}
            <div className="rounded-lg border border-border bg-bg/60 p-3.5 mb-4 text-[12.5px]">
              <h4 className="font-bold text-navy text-[13.5px] mb-1">
                {activeAckModal.title}
              </h4>
              <p className="text-navy-soft leading-relaxed mb-2.5">
                {activeAckModal.description}
              </p>

              {/* RECOMMENDED ACTIONS DISPLAY */}
              <div className="rounded border border-blue/20 bg-blue-tint/40 p-2.5">
                <span className="font-bold text-blue-dark block uppercase tracking-wider text-[10px] mb-1">
                  Recommended Operational Action Plan:
                </span>
                {activeAckModal.recommended_actions && activeAckModal.recommended_actions.length > 1 ? (
                  <ol className="flex flex-col gap-1 text-[12px]">
                    {activeAckModal.recommended_actions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-navy-dark">
                        <span className="font-bold text-blue-dark">{idx + 1}.</span>
                        <span className="font-semibold leading-snug">{act}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="font-semibold text-navy-dark leading-snug">
                    {activeAckModal.recommended_action || activeAckModal.recommended_actions?.[0]}
                  </p>
                )}
              </div>
            </div>

            {/* RESPONSE OPTIONS */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-navy mb-2">
                Select Operational Follow-up Response <span className="text-red">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACKNOWLEDGEMENT_OPTIONS.map((opt) => {
                  const isSelected = ackResponseOption === opt.label;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAckResponseOption(opt.label)}
                      disabled={ackSubmitting}
                      className={`flex flex-col text-left p-3 rounded-lg border transition-all text-[12px] ${
                        isSelected
                          ? "border-blue bg-blue-tint/60 text-navy ring-1 ring-blue/40 font-semibold"
                          : "border-border bg-surface text-navy-soft hover:border-blue/40 hover:bg-bg"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-navy">
                        <span>{opt.label}</span>
                        <input
                          type="radio"
                          name="ackResponse"
                          checked={isSelected}
                          onChange={() => setAckResponseOption(opt.label)}
                          className="h-3.5 w-3.5 text-blue accent-blue"
                        />
                      </div>
                      <span className="text-[10.5px] font-normal text-navy-muted mt-1 leading-snug">
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OPTIONAL NOTES FIELD */}
            <div className="mb-4">
              <label htmlFor="ack-notes" className="block text-[11px] font-bold uppercase tracking-wider text-navy mb-1.5">
                Operational Notes (Optional)
              </label>
              <textarea
                id="ack-notes"
                rows={3}
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                disabled={ackSubmitting}
                placeholder="Add optional notes regarding staffing assignment, supervisor confirmation, or follow-up timelines..."
                className="w-full rounded-md border border-border bg-bg p-2.5 text-[12.5px] text-navy placeholder:text-navy-muted/70 focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:opacity-50"
              />
            </div>

            {/* ERROR MESSAGE DISPLAY */}
            {ackError && (
              <div className="mb-4 rounded-md border border-red/30 bg-red-tint p-3 text-[12px] font-semibold text-red flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{ackError}</span>
              </div>
            )}

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-end gap-2.5 border-t border-border pt-3.5">
              <button
                type="button"
                onClick={() => setActiveAckModal(null)}
                disabled={ackSubmitting}
                className="rounded-md border border-border bg-bg px-4 py-2 text-[12.5px] font-semibold text-navy hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAcknowledgement}
                disabled={ackSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-navy px-4.5 py-2 text-[12.5px] font-bold text-white hover:bg-navy-muted transition-all disabled:opacity-50"
              >
                {ackSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Confirm Acknowledgement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL DIALOG */}
      {activeResolveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-dark/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !resolveSubmitting) {
              setActiveResolveModal(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-elevated max-h-[90vh] overflow-y-auto">
            {/* HEADER */}
            <div className="flex items-start justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-green/30 bg-green-tint text-green">
                  <Check className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h3 id="resolve-modal-title" className="text-[15px] font-bold text-navy">
                    Mark Operational Issue as Resolved
                  </h3>
                  <p className="text-[11.5px] font-semibold text-navy-soft uppercase tracking-wider mt-0.5">
                    Category: {activeResolveModal.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !resolveSubmitting && setActiveResolveModal(null)}
                disabled={resolveSubmitting}
                className="rounded-md p-1 text-navy-muted hover:bg-bg hover:text-navy disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ISSUE DETAILS CARD */}
            <div className="rounded-lg border border-border bg-bg/60 p-3.5 mb-4 text-[12.5px]">
              <h4 className="font-bold text-navy text-[13.5px] mb-1">
                {activeResolveModal.title}
              </h4>
              <p className="text-navy-soft leading-relaxed mb-2.5">
                {activeResolveModal.description}
              </p>
              <div className="rounded border border-blue/20 bg-blue-tint/40 p-2 text-navy-dark text-[11.5px]">
                <strong className="text-blue-dark">Intervention:</strong> {activeResolveModal.recommended_action || activeResolveModal.recommended_actions?.[0]}
              </div>
            </div>

            {/* RESOLUTION NOTES FIELD */}
            <div className="mb-4">
              <label htmlFor="resolve-notes" className="block text-[11px] font-bold uppercase tracking-wider text-navy mb-1.5">
                Operational Resolution Notes (Optional)
              </label>
              <textarea
                id="resolve-notes"
                rows={3}
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                disabled={resolveSubmitting}
                placeholder="e.g. Inpatient floor transfer completed, auxiliary nurses deployed, bay throughput restored..."
                className="w-full rounded-md border border-border bg-bg p-2.5 text-[12.5px] text-navy placeholder:text-navy-muted/70 focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue disabled:opacity-50"
              />
            </div>

            {/* ERROR MESSAGE DISPLAY */}
            {resolveError && (
              <div className="mb-4 rounded-md border border-red/30 bg-red-tint p-3 text-[12px] font-semibold text-red flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{resolveError}</span>
              </div>
            )}

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-end gap-2.5 border-t border-border pt-3.5">
              <button
                type="button"
                onClick={() => setActiveResolveModal(null)}
                disabled={resolveSubmitting}
                className="rounded-md border border-border bg-bg px-4 py-2 text-[12.5px] font-semibold text-navy hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolution}
                disabled={resolveSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-green px-4.5 py-2 text-[12.5px] font-bold text-white hover:bg-green/90 transition-all disabled:opacity-50"
              >
                {resolveSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirm Resolution</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SUCCESS TOAST BANNER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-green/40 bg-navy text-white px-4 py-3 shadow-elevated animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="h-4.5 w-4.5 text-green shrink-0" />
          <span className="text-[13px] font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded p-0.5 text-white/70 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
