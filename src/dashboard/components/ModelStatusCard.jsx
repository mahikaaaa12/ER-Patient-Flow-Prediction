import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Cpu, AlertTriangle, RefreshCw, XCircle, Database, Layers } from "lucide-react";
import PageCard from "./PageCard";
import { erflowApi } from "../../services/api";

const STATUS_CONFIG = {
  loaded: { label: "Online / Loaded", tone: "green", icon: CheckCircle2 },
  loading: { label: "Loading...", tone: "blue", icon: RefreshCw },
  unavailable: { label: "Unavailable", tone: "amber", icon: AlertTriangle },
  error: { label: "Error", tone: "red", icon: XCircle },
};

function StatusBadge({ state }) {
  const cfg = STATUS_CONFIG[state] || STATUS_CONFIG.unavailable;
  const Icon = cfg.icon;

  const TONE_CLASSES = {
    green: "bg-green-tint text-green border-green/30",
    blue: "bg-blue-tint text-blue border-blue/30",
    amber: "bg-amber-tint text-amber border-amber/30",
    red: "bg-red-tint text-red border-red/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
        TONE_CLASSES[cfg.tone]
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

export default function ModelStatusCard({ className = "" }) {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function fetchStatus() {
    setLoading(true);
    setError(null);
    try {
      const data = await erflowApi.checkHealth();
      setHealthData(data);
    } catch (err) {
      console.warn("Health check failed:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  // Helper to determine if at least one expected model in a category is loaded
  const isCategoryLoaded = (catObj) => {
    if (!catObj) return false;
    const vals = Object.values(catObj);
    if (vals.length === 0) return false;
    return vals.some(
      (v) => v === true || v === "loaded" || (typeof v === "object" && (v?.loaded_status === "loaded" || v === true))
    );
  };

  // Compute status for each engine
  const backendState = loading
    ? "loading"
    : error
    ? "error"
    : healthData?.status === "healthy"
    ? "loaded"
    : "unavailable";

  const supOk = isCategoryLoaded(healthData?.models?.supervised);
  const supervisedState = loading ? "loading" : error ? "error" : supOk ? "loaded" : "unavailable";

  const unsupOk = isCategoryLoaded(healthData?.models?.unsupervised);
  const unsupervisedState = loading ? "loading" : error ? "error" : unsupOk ? "loaded" : "unavailable";

  const dlOk = isCategoryLoaded(healthData?.models?.deep_learning);
  const deepLearningState = loading ? "loading" : error ? "error" : dlOk ? "loaded" : "unavailable";

  const engines = [
    {
      id: "backend",
      title: "FastAPI Backend Service",
      subtitle: healthData?.service || "ML Inference Engine",
      state: backendState,
      details: healthData ? "Uvicorn REST API — Active" : "Offline",
      icon: Activity,
    },
    {
      id: "supervised",
      title: "Supervised ML Models",
      subtitle: "XGBoost Regressor & Classifier",
      state: supervisedState,
      details: "Preprocessors & Label Encoders Loaded",
      icon: Cpu,
    },
    {
      id: "unsupervised",
      title: "Unsupervised ML Models",
      subtitle: "K-Means Clustering & DBSCAN",
      state: unsupervisedState,
      details: "StandardScaler & PCA Projector Loaded",
      icon: Database,
    },
    {
      id: "deep_learning",
      title: "Deep Learning Model",
      subtitle: "2-Layer LSTM Neural Network",
      state: deepLearningState,
      details: "RobustScalers & 168h Window Config Loaded",
      icon: Layers,
    },
  ];

  return (
    <PageCard
      title="ML Model Engine Status"
      subtitle="Live health and artifact status fetched directly from the FastAPI backend endpoint"
      icon={Activity}
      className={className}
      action={
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-navy-soft transition-colors hover:bg-bg hover:text-navy disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {engines.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-bg p-4 shadow-soft"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-navy shadow-soft">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <StatusBadge state={item.state} />
                </div>
                <h4 className="mt-3 text-[14px] font-semibold text-navy">{item.title}</h4>
                <p className="mt-0.5 text-[12px] font-medium text-navy-soft">{item.subtitle}</p>
              </div>
              <p className="mt-3 border-t border-border/60 pt-2 text-[11px] font-medium text-navy-muted">
                {item.details}
              </p>
            </div>
          );
        })}
      </div>
    </PageCard>
  );
}
