import React, { createContext, useContext, useEffect, useState } from "react";
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
        : null;

      if (res) {
        setPredictions(res);
        setHasRunPredictions(true);
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastUpdated(now);
        setModelStatus({
          forecast: "success",
          waiting_time: "success",
          crowding_risk: "success",
          flow_pattern: "success",
          surge_detection: "success",
        });

        try {
          sessionStorage.setItem("erflow_predictions", JSON.stringify(res));
          sessionStorage.setItem("erflow_last_updated", now);
        } catch (e) {
          console.warn("Failed to persist predictions:", e);
        }
      } else {
        setHasRunPredictions(true);
        setModelStatus({
          forecast: "demo",
          waiting_time: "demo",
          crowding_risk: "demo",
          flow_pattern: "demo",
          surge_detection: "demo",
        });
      }
    } catch (err) {
      console.warn("Central prediction update failed:", err.message);
      setError(err.message || "Failed to update multi-model predictions.");
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

  const value = {
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
  };

  return <ERContext.Provider value={value}>{children}</ERContext.Provider>;
}

export function useERContext() {
  return useContext(ERContext);
}
