/**
 * ERFlow API Client Service
 * Connects React frontend to FastAPI ML Inference Backend.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

/**
 * Helper to handle fetch requests with error parsing and fallback support.
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        errorMessage = errJson.detail || errJson.message || errorMessage;
      } catch {
        // Fallback to HTTP status message
      }
      throw new Error(errorMessage);
    }
    return await res.json();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("Unable to connect to ERFlow ML Inference Engine. Please verify the backend is running at http://localhost:8000.");
    }
    throw error;
  }
}

export const erflowApi = {
  /**
   * System health check
   */
  async checkHealth() {
    return fetchApi("/api/health");
  },

  /**
   * Combined Overview Dashboard payload
   */
  async getDashboardOverview(hospitalState) {
    if (hospitalState) {
      return fetchApi("/api/dashboard/overview", {
        method: "POST",
        body: JSON.stringify(hospitalState),
      });
    }
    return fetchApi("/api/dashboard/overview", { method: "GET" });
  },

  /**
   * Patient Arrival Forecast (Deep Learning LSTM)
   */
  async getPatientForecast(hospitalState) {
    return fetchApi("/api/predict/deep-learning", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    });
  },

  /**
   * Waiting Time Prediction (Supervised XGBoost Regressor)
   */
  async getWaitingTime(hospitalState) {
    return fetchApi("/api/predict/waiting-time", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    });
  },

  /**
   * Crowding Risk Prediction (Supervised XGBoost Classifier)
   */
  async getCrowdingRisk(hospitalState) {
    return fetchApi("/api/predict/crowding-risk", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    });
  },

  /**
   * Flow Pattern Discovery (Unsupervised K-Means + PCA)
   */
  async getFlowPatterns(hospitalState) {
    return fetchApi("/api/patterns/flow", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    });
  },

  /**
   * Surge Anomaly Detection (Unsupervised DBSCAN)
   */
  async getSurgeDetection(hospitalState) {
    return fetchApi("/api/surge/detect", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    });
  },

  async detectSurge(hospitalState) {
    return this.getSurgeDetection(hospitalState);
  },

  /**
   * AI Assistant Query Handler
   */
  async queryAIAssistant(question, hospitalState) {
    return fetchApi("/api/ai-assistant/query", {
      method: "POST",
      body: JSON.stringify({
        question,
        hospital_state: hospitalState || null,
      }),
    });
  },

  /**
   * Chatbot Microservice API Handler (Unified FastAPI Backend)
   */
  async sendChatMessage(message, sessionId, context) {
    const CHATBOT_URL = (
      import.meta.env.VITE_CHATBOT_API_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:8000"
    ).replace(/\/+$/, "");
    const url = `${CHATBOT_URL}/api/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        session_id: sessionId || null,
        context: context || {},
      }),
    });
    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errText = errJson.detail || errText;
      } catch {}
      throw new Error(errText);
    }
    return await res.json();
  },

  /**
   * Model Monitoring & Telemetry Report
   */
  async getMonitoringReport() {
    return fetchApi("/api/monitoring");
  },
};
