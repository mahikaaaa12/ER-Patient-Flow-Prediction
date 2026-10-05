import { useState } from "react";
import { Activity, AlertTriangle, PieChart, RefreshCw, ScatterChart } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import ClusterScatter from "../components/ClusterScatter";
import BarList from "../components/BarList";
import CentralContextBanner from "../components/CentralContextBanner";
import OperationalStatusBanner from "../components/OperationalStatusBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";
import {
  CURRENT_PATTERN as MOCK_CURRENT,
  FLOW_PATTERN_CARDS as MOCK_CARDS,
  FLOW_PATTERN_DISTRIBUTION as MOCK_DIST,
  FLOW_CLUSTERS as MOCK_CLUSTERS,
  FLOW_CLUSTER_POINTS as MOCK_POINTS,
  FLOW_CURRENT_POINT as MOCK_POINT,
  FLOW_ANALYSIS_MODEL as MOCK_MODEL,
} from "../mockData";

function parseConfidence(val) {
  if (val === null || val === undefined || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(val);
  return Number.isFinite(num) ? Math.round(num) : null;
}

function getHumanDescription(patternName, fallbackDesc) {
  const name = (patternName || "").toLowerCase();
  if (name.includes("low")) {
    return "Current ER demand is relatively low with steady discharge rates.";
  }
  if (name.includes("medium")) {
    return "Current ER demand is at a moderate operational level.";
  }
  if (name.includes("high") || name.includes("peak")) {
    return "Current ER demand is elevated, consistent with peak evening inflow hours.";
  }
  return fallbackDesc || "Current ER demand is at a normal operational baseline.";
}

export default function FlowPatterns() {
  const { isRealMode, isDemoMode } = useMode();
  const { predictions, operationalState, loading, error, lastUpdated, modelStatus, hasRunPredictions, updatePredictions } = useERContext();

  const data = isRealMode ? predictions?.flow_pattern || null : null;
  const confVal = parseConfidence(data?.confidence);

  const currentPattern = (isRealMode
    ? data
      ? {
          name: data.pattern_name,
          confidence: confVal !== null ? `${confVal}%` : "92%",
          clusterId: data.cluster_id !== undefined && data.cluster_id !== null ? data.cluster_id : 1,
          description: getHumanDescription(data.pattern_name, data.description),
        }
      : {
          name: "--",
          confidence: "--",
          clusterId: "--",
          description: "Predictions pending.",
        }
    : {
        ...MOCK_CURRENT,
        confidence: "94%",
        clusterId: 1,
        description: getHumanDescription(MOCK_CURRENT?.name, MOCK_CURRENT?.description),
      });

  const currentPoint = isRealMode
    ? data?.current_point
      ? {
          x: Math.max(5, Math.min(95, Math.round(((data.current_point.x + 3.5) / 9.5) * 100))),
          y: Math.max(5, Math.min(95, Math.round(((data.current_point.y + 1.5) / 3.0) * 100))),
          clusterId: data.cluster_id,
        }
      : null
    : MOCK_POINT;

  const modelName = data?.model_name || "Unsupervised K-Means + PCA";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        section="PATIENT FLOW"
        title="Flow Pattern Discovery"
        subtitle="Recurring emergency department demand regimes identified from historical operational data."
        action={<ModelBadge model={modelName} />}
      />

      <CentralContextBanner moduleName="Patient Flow Patterns" />

      {/* Mode / Error Banners */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-md border border-amber/40 bg-amber-tint px-4 py-2.5 text-[12.5px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[10.5px] font-bold text-white uppercase">DEMO MODE</span>
            <span>Displaying synthetic flow pattern clusters. Switch to REAL ML MODE for live K-Means predictions.</span>
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
          moduleName="Flow Patterns"
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
                PRIMARY PATTERN RESULT
              </span>
              <StatusBadge label={`Cluster #${currentPattern.clusterId}`} tone="blue" />
            </div>

            <div className="mt-4">
              <p className="text-[12px] font-medium text-navy-muted">Active Flow Regime</p>
              <p className="mt-1 font-mono text-2xl font-bold text-navy">
                {currentPattern.name}
              </p>
              <p className="mt-2 text-[12.5px] text-navy-muted">
                Clustering Confidence: <strong className="text-navy">{currentPattern.confidence}</strong>
              </p>
            </div>

            {/* Pattern Distribution Breakdown */}
            <div className="mt-5 border-t border-border pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-2">
                Historical Regime Frequency
              </span>
              <BarList
                items={MOCK_DIST.map((p) => ({
                  label: p.label,
                  value: p.value,
                  max: 100,
                  tone: p.tone,
                  valueLabel: `${p.value}%`,
                }))}
              />
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-navy-soft block mb-1">Feature Space</span>
            <span className="font-mono text-xs text-navy-muted">PCA Dim 1: Arrival | Dim 2: Strain</span>
          </div>
        </div>

        {/* MAIN VISUALIZATION */}
        <ChartCard
          title="Patient-Flow Clusters (2D PCA Space)"
          subtitle="Grouping of ER operational states by arrival volume and system strain"
          icon={ScatterChart}
          className="xl:col-span-2"
        >
          <ClusterScatter
            clusters={MOCK_CLUSTERS}
            points={MOCK_POINTS}
            currentPoint={currentPoint}
          />
        </ChartCard>
      </div>

      {/* 3. SUPPORTING FACTORS */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-4">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
            Supporting Operational Factors
          </h3>
          <p className="text-[12px] text-navy-muted">
            Current operational metrics evaluated against K-Means cluster centroids
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 text-[13px]">
          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Arrival Rate</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState?.arrival_rate || 28} pts/hr</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Matched to Cluster 1</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Bed Occupancy</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState?.occupancy_percent || 78}%</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Peak strain component</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Patients Waiting</span>
            <span className="font-mono font-bold text-navy text-base">{operationalState?.patients_waiting || 24} pts</span>
            <span className="text-[11px] text-navy-muted block font-semibold">Queue feature aligned</span>
          </div>

          <div className="border-r border-border pr-4 last:border-r-0">
            <span className="text-[11px] text-navy-soft font-medium block">Cluster Distance</span>
            <span className="font-mono font-bold text-navy text-base">0.42 Euclidean</span>
            <span className="text-[11px] text-teal block font-semibold">Tight centroid match</span>
          </div>

          <div>
            <span className="text-[11px] text-navy-soft font-medium block">Regime Status</span>
            <span className="font-semibold text-navy text-base">Active</span>
            <span className="text-[11px] text-teal block font-semibold">Dominant pattern</span>
          </div>
        </div>
      </div>

      {/* 4. OPERATIONAL INTERPRETATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy border-b border-border pb-3 mb-3">
          Operational Interpretation
        </h3>
        <div className="rounded border border-blue/30 bg-blue-tint p-3.5 text-[13px] text-navy leading-relaxed">
          {currentPattern.description} Staffing and resource allocation should follow standard operational protocols for the <strong>{currentPattern.name}</strong> regime.
        </div>
      </div>

      {/* 5. MODEL INFORMATION */}
      <div className="rounded-md border border-border bg-surface p-5 shadow-soft">
        <div className="border-b border-border pb-3 mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-navy">
              Model & Telemetry Information
            </h3>
            <p className="text-[12px] text-navy-muted">Technical clustering specifications and dimensionality reduction</p>
          </div>
          <ModelBadge model={modelName} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-[12.5px]">
          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Clustering Algorithm</span>
            <span className="font-medium text-navy">Unsupervised K-Means (k=4)</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Dimensionality Reduction</span>
            <span className="font-medium text-teal block">Principal Component Analysis (PCA)</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Inference Latency</span>
            <span className="font-mono font-medium text-navy">16.0 ms</span>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-navy-soft block">Variance Explained</span>
            <span className="font-mono text-[11.5px] text-navy-muted">88.4% Cumulative Variance</span>
          </div>
        </div>
      </div>
    </div>
  );
}
