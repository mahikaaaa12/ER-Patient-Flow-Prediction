import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { erflowApi } from "../services/api";
import { useMode } from "./ModeContext";

const DEFAULT_OPERATIONAL_STATE = {
  occupancy_percent: 78,
  patients_waiting: 24,
  arrival_rate: 28,
  available_beds: 8,
  available_doctors: 5,
  available_nurses: 9,
  severity_level: 3.0,
  hour_of_day: 18,
  day_of_week: 4,
  month: 7,
};

const ERContext = createContext({
  operationalState: DEFAULT_OPERATIONAL_STATE,
  setOperationalState: () => {},
  predictions: null,
  loading: false,
  error: null,
  lastUpdated: null,
  modelStatus: {
    forecast: "idle",
    waiting_time: "idle",
    crowding_risk: "idle",
    flow_pattern: "idle",
    surge_detection: "idle",
  },
  updatePredictions: async () => {},
  resetToBaseline: () => {},
});

export function ERProvider({ children }) {
  const { isRealMode } = useMode();

  const [operationalState, setOperationalStateState] = useState(() => {
    try {
      const saved = localStorage.getItem("erflow_operational_state");
      return saved ? JSON.parse(saved) : DEFAULT_OPERATIONAL_STATE;
    } catch {
      return DEFAULT_OPERATIONAL_STATE;
    }
  });

  const [predictions, setPredictions] = useState(() => {
    try {
      const saved = sessionStorage.getItem("erflow_predictions");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [hasRunPredictions, setHasRunPredictions] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem("erflow_predictions"));
    } catch {
      return false;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => {
    return localStorage.getItem("erflow_last_updated") || null;
  });

  const [modelStatus, setModelStatus] = useState({
    forecast: "idle",
    waiting_time: "idle",
    crowding_risk: "idle",
    flow_pattern: "idle",
    surge_detection: "idle",
  });

  const setOperationalState = (newState) => {
    setOperationalStateState(newState);
    try {
      localStorage.setItem("erflow_operational_state", JSON.stringify(newState));
    } catch (e) {
      console.warn("Failed to persist operationalState to localStorage:", e);
    }
  };

function generateDemoPredictions(state, horizon = "24h") {
  const occ = Number(state.occupancy_percent ?? 78);
  const waitPts = Number(state.patients_waiting ?? 24);
  const arrRate = Number(state.arrival_rate ?? 28);
  const availBeds = Number(state.available_beds ?? 8);
  const docs = Number(state.available_doctors ?? 5);

  const isSurge = arrRate > 35 || occ > 85;
  const rawWait = Math.round(10 + waitPts * 1.2 + arrRate * 0.6 - docs * 1.5 - availBeds * 0.5);
  const finalWaitMin = Math.max(5, Math.min(180, rawWait));

  const crowdingScore = Math.min(100, Math.max(0, Math.round(occ * 0.5 + (waitPts / 50) * 30 + (arrRate / 40) * 20)));
  const crowdingLevel = crowdingScore >= 80 ? "CRITICAL" : crowdingScore >= 60 ? "HIGH" : crowdingScore >= 35 ? "MODERATE" : "LOW";

  const patternName = arrRate > 35 ? "High Demand" : arrRate < 18 ? "Low Demand" : "Medium Demand";

  let forecastObj = {};
  if (horizon === "7d") {
    const dailyBase = Math.round(arrRate * 18.0);
    forecastObj = {
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
    const dailyBase = Math.round(arrRate * 18.0);
    const seriesData = [];
    for (let i = 30; i >= 1; i--) {
      seriesData.push({ t: `Day -${i}`, value: Math.round(dailyBase * (0.9 + 0.15 * Math.sin(i))), kind: "observed" });
    }
    for (let i = 1; i <= 30; i++) {
      seriesData.push({ t: `Day +${i} (proj.)`, value: Math.round(dailyBase * (0.95 + 0.18 * Math.sin(i + 3))), kind: "forecast" });
    }
    forecastObj = {
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
    // 24h
    forecastObj = {
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

  return {
    forecast: forecastObj,
    waiting_time: {
      waiting_time_minutes: finalWaitMin,
      predicted_1h: Math.round(finalWaitMin * 1.1),
      predicted_peak: Math.round(finalWaitMin * 1.35),
      trend: arrRate > 25 ? "Increasing" : "Stable",
      model_name: "Supervised XGBoost Regressor",
      hourly_trend: [
        { t: "12 PM", value: Math.round(finalWaitMin * 0.8), kind: "observed" },
        { t: "3 PM", value: Math.round(finalWaitMin * 0.9), kind: "observed" },
        { t: "6 PM", value: finalWaitMin, kind: "observed" },
        { t: "9 PM (proj.)", value: Math.round(finalWaitMin * 1.2), kind: "forecast" },
      ],
      explanation: {
        top_factors: [
          { feature: "Patients Waiting", direction: "increases", importance: 0.45 },
          { feature: "Arrival Velocity", direction: "increases", importance: 0.30 },
          { feature: "Available Doctors", direction: "decreases", importance: 0.15 },
          { feature: "Available Beds", direction: "decreases", importance: 0.10 },
        ],
        top_contributing_features: [
          { feature: "Patients Waiting", contribution: 18.4, direction: "increases_wait" },
          { feature: "Arrival Rate", contribution: 12.1, direction: "increases_wait" },
          { feature: "Occupancy Percent", contribution: 8.5, direction: "increases_wait" },
          { feature: "Staff Total", contribution: -4.2, direction: "decreases_wait" },
        ],
      },
    },
    crowding_risk: {
      crowding_level: crowdingLevel,
      crowding_score: crowdingScore,
      expected_window: "Next 3 Hours",
      class_probability: crowdingScore / 100,
      probabilities: {
        Critical: crowdingLevel === "CRITICAL" ? 0.75 : 0.1,
        High: crowdingLevel === "HIGH" ? 0.70 : 0.15,
        Moderate: crowdingLevel === "MODERATE" ? 0.65 : 0.15,
        Low: crowdingLevel === "LOW" ? 0.80 : 0.05,
      },
      model_name: "Supervised XGBoost Classifier",
      risk_timeline: [
        { time: "3 PM", level: "MODERATE" },
        { time: "5 PM", level: crowdingLevel === "CRITICAL" ? "HIGH" : crowdingLevel },
        { time: "7 PM", level: crowdingLevel },
        { time: "9 PM", level: crowdingLevel === "CRITICAL" ? "HIGH" : "MODERATE" },
      ],
      explanation: {
        top_factors: [
          { feature: "Occupancy Percent", direction: "increases", importance: 0.50 },
          { feature: "Patients Waiting", direction: "increases", importance: 0.30 },
          { feature: "Arrival Velocity", direction: "increases", importance: 0.20 },
        ],
        top_contributing_features: [
          { feature: "Occupancy Percent", contribution: 24.1, direction: "increases_risk" },
          { feature: "Patients Waiting", contribution: 19.3, direction: "increases_risk" },
          { feature: "Arrival Rate", contribution: 14.0, direction: "increases_risk" },
        ],
      },
    },
    flow_pattern: {
      pattern_name: patternName,
      confidence: 91.5,
      cluster_id: patternName === "High Demand" ? 0 : patternName === "Low Demand" ? 2 : 1,
      description: `Current ER demand exhibits a ${patternName} regime with expected throughput matching operational inputs.`,
      current_point: { x: arrRate / 10, y: occ / 50 },
      model_name: "Unsupervised K-Means + PCA",
    },
    surge_detection: {
      status: isSurge ? "ANOMALOUS SURGE DETECTED" : "NORMAL OPERATIONAL LOAD",
      is_surge: isSurge,
      severity: isSurge ? (arrRate > 45 ? "High" : "Moderate") : "Low",
      normal_arrival_rate: 21,
      current_arrival_rate: arrRate,
      deviation_percent: `${Math.round(((arrRate - 21) / 21) * 100)}%`,
      detected_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      description: isSurge
        ? `Surge anomaly detected: Current arrival velocity (${arrRate} pts/hr) exceeds baseline (21 pts/hr).`
        : `Arrival velocity (${arrRate} pts/hr) is within normal statistical parameters.`,
      model_name: "Unsupervised DBSCAN Anomaly Engine",
      timeline: [
        { t: "3 PM", expected: 21, actual: Math.round(arrRate * 0.7), anomaly: false },
        { t: "4 PM", expected: 21, actual: Math.round(arrRate * 0.85), anomaly: false },
        { t: "5 PM", expected: 21, actual: arrRate, anomaly: isSurge },
        { t: "6 PM", expected: 21, actual: Math.round(arrRate * 1.1), anomaly: isSurge },
      ],
    },
    ai_summary_text: `Patient demand is projected at ${Math.round(arrRate * 2.4)} arrivals over the next 3 hours. Expected wait time is approximately ${finalWaitMin} minutes with a ${crowdingLevel} crowding risk (score: ${crowdingScore}/100). ER flow pattern exhibits ${patternName} conditions with ${isSurge ? "an abnormal arrival surge" : "normal operational load"}.`,
  };
}

  async function updatePredictions(customState = null) {
    const stateToUse = customState || operationalState;
    setLoading(true);
    setError(null);
    setModelStatus({
      forecast: "updating",
      waiting_time: "updating",
      crowding_risk: "updating",
      flow_pattern: "updating",
      surge_detection: "updating",
    });

    try {
      const res = isRealMode
        ? await erflowApi.getDashboardOverview(stateToUse)
        : generateDemoPredictions(stateToUse);

      if (res) {
        setPredictions(res);
        setHasRunPredictions(true);
        setError(null);
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastUpdated(now);

        const statusMode = isRealMode ? "success" : "demo";
        const computedStatus = {
          forecast: res.forecast && !res.forecast.error ? (res.engine_status?.forecast || statusMode) : "failed",
          waiting_time: res.waiting_time && !res.waiting_time.error ? (res.engine_status?.waiting_time || statusMode) : "failed",
          crowding_risk: res.crowding_risk && !res.crowding_risk.error ? (res.engine_status?.crowding_risk || statusMode) : "failed",
          flow_pattern: res.flow_pattern && !res.flow_pattern.error ? (res.engine_status?.flow_pattern || statusMode) : "failed",
          surge_detection: res.surge_detection && !res.surge_detection.error ? (res.engine_status?.surge_detection || statusMode) : "failed",
        };

        setModelStatus(computedStatus);

        try {
          sessionStorage.setItem("erflow_predictions", JSON.stringify(res));
          sessionStorage.setItem("erflow_last_updated", now);
        } catch (e) {
          console.warn("Failed to persist predictions:", e);
        }
      }
    } catch (err) {
      console.warn("Central prediction update failed:", err.message);
      setError(err);
      setModelStatus({
        forecast: "error",
        waiting_time: "error",
        crowding_risk: "error",
        flow_pattern: "error",
        surge_detection: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const resetToBaseline = () => {
    setOperationalState(DEFAULT_OPERATIONAL_STATE);
  };

  useEffect(() => {
    if (!predictions) {
      updatePredictions(operationalState);
    }
  }, [isRealMode]);

  const value = useMemo(() => ({
    operationalState,
    setOperationalState,
    predictions,
    hasRunPredictions,
    loading,
    error,
    lastUpdated,
    modelStatus,
    updatePredictions,
    resetToBaseline,
    defaultOperationalState: DEFAULT_OPERATIONAL_STATE,
  }), [
    operationalState,
    predictions,
    hasRunPredictions,
    loading,
    error,
    lastUpdated,
    modelStatus,
  ]);

  return <ERContext.Provider value={value}>{children}</ERContext.Provider>;
}

export function useERContext() {
  return useContext(ERContext);
}
