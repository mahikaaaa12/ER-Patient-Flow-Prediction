/**
 * ERFlow API Client Service
 * Connects React frontend to FastAPI ML Inference Backend.
 */

import { APP_CONFIG } from "../config/appConfig";

const BASE_URL = APP_CONFIG.apiBaseUrl;
const CHATBOT_URL = APP_CONFIG.chatbotApiUrl;

/**
 * Helper to handle fetch requests with error parsing and fallback support.
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: controller.signal,
    ...options,
  };

  try {
    const res = await fetch(url, config);
    clearTimeout(timeoutId);
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
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Request to ML Inference Engine timed out after 15s at ${BASE_URL || "backend"}.`);
    }
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      const target = BASE_URL || "configured backend URL";
      throw new Error(`Unable to connect to ERFlow ML Inference Engine at ${target}. Please verify backend service status.`);
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
    const url = `${CHATBOT_URL}/api/chat`;
    const payload = {
      message,
      session_id: sessionId || null,
      context: context || {},
    };

    console.log("[CHATBOT] User message:", message);
    console.log("[CHATBOT] Request URL:", url);
    console.log("[CHATBOT] Request payload:", payload);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[CHATBOT] Response status:", res.status, res.statusText);

      if (!res.ok) {
        let errText = `HTTP ${res.status} ${res.statusText}`;
        try {
          const errJson = await res.json();
          console.error("[CHATBOT] Response body error:", errJson);
          errText = errJson.detail || errJson.message || errText;
        } catch {
          console.error("[CHATBOT] Could not parse error response body JSON.");
        }
        throw new Error(errText);
      }
      const data = await res.json();
      console.log("[CHATBOT] Response data payload:", data);
      return data;
    } catch (error) {
      console.error("[CHATBOT] Backend service error:", error.message);
      throw error;
    }
  },

  /**
   * Model Monitoring & Telemetry Report
   */
  async getMonitoringReport() {
    return fetchApi("/api/monitoring");
  },
};
