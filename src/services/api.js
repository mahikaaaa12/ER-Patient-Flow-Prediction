/**
 * ERFlow Centralized API Client Service
 * Connects React frontend to FastAPI ML Inference Backend with non-blocking readiness probing,
 * bounded exponential backoff retries, and high-reliability error handling.
 */

import { APP_CONFIG } from "../config/appConfig";

const BASE_URL = APP_CONFIG.apiBaseUrl;
const CHATBOT_URL = APP_CONFIG.chatbotApiUrl;

const RETRYABLE_STATUS_CODES = [502, 503, 504, 530];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackendVerifiedReady = false;

/**
 * Lightweight readiness probe checking /api/ready endpoint with exponential backoff.
 */
async function checkReadiness(maxProbeRetries = 2) {
  const url = `${BASE_URL}/api/ready`;
  let attempt = 0;

  while (attempt <= maxProbeRetries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.ready) {
          isBackendVerifiedReady = true;
          return data;
        }
      }
    } catch {
      // Backend cold start in progress
    }
    attempt++;
    if (attempt <= maxProbeRetries) {
      await delay(1000 * Math.pow(1.5, attempt));
    }
  }
  return { ready: false, status: "initializing" };
}

/**
 * Centralized inference request runner handling retries, timeouts, and readiness checks.
 */
async function fetchWithReliability(endpoint, options = {}, maxRetries = 2, timeoutMs = 25000) {
  const url = `${BASE_URL}${endpoint}`;
  let attempt = 0;

  // Probe backend readiness if not verified recently
  if (!isBackendVerifiedReady && endpoint !== "/api/ready" && endpoint !== "/api/health") {
    const probe = await checkReadiness(1);
    if (probe.ready) {
      isBackendVerifiedReady = true;
    }
  }

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

      if (res.ok) {
        isBackendVerifiedReady = true;
        return await res.json();
      }

      let errorMessage = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errJson = await res.json();
        errorMessage = errJson.detail || errJson.message || errorMessage;
      } catch {
        // Fallback to HTTP status message
      }

      const error = new Error(errorMessage);
      error.status = res.status;

      // Do NOT retry deterministic validation (400, 422) or authentication errors
      if (!RETRYABLE_STATUS_CODES.includes(res.status) || attempt >= maxRetries) {
        throw error;
      }

      console.warn(`[ERFlow API] Retrying request to ${endpoint} (attempt ${attempt + 1}/${maxRetries}): ${errorMessage}`);
    } catch (error) {
      clearTimeout(timeoutId);

      // Non-retryable client errors throw immediately
      if (error.status && !RETRYABLE_STATUS_CODES.includes(error.status)) {
        throw error;
      }

      const isAbort = error.name === "AbortError";
      const isNetworkErr = error.name === "TypeError" && error.message.includes("fetch");

      if (attempt >= maxRetries) {
        if (isAbort) {
          const sec = Math.round(timeoutMs / 1000);
          const err = new Error("Prediction request is taking longer than expected");
          err.isTimeout = true;
          err.status = 504;
          err.endpoint = endpoint;
          err.requestId = `req-${Math.random().toString(36).substring(2, 9)}`;
          err.technicalMessage = `AbortError: Request to ML Inference Engine timed out after ${sec}s at ${BASE_URL || "configured backend URL"}.`;
          throw err;
        }
        if (isNetworkErr) {
          const target = BASE_URL || "configured backend URL";
          const err = new Error("Prediction services temporarily unavailable");
          err.isNetworkError = true;
          err.status = 503;
          err.endpoint = endpoint;
          err.requestId = `req-${Math.random().toString(36).substring(2, 9)}`;
          err.technicalMessage = `TypeError: Unable to connect to ERFlow ML Inference Engine at ${target}. Please verify backend service status.`;
          throw err;
        }
        error.endpoint = endpoint;
        error.requestId = `req-${Math.random().toString(36).substring(2, 9)}`;
        error.technicalMessage = error.message;
        error.message = "Prediction services temporarily unavailable";
        throw error;
      }

      console.warn(`[ERFlow API] Transient network/server error at ${endpoint} (attempt ${attempt + 1}/${maxRetries}):`, error.message);
    }

    attempt++;
    const backoffMs = 600 * Math.pow(1.8, attempt) + Math.random() * 300;
    await delay(backoffMs);
  }
}

export const erflowApi = {
  /**
   * System health check
   */
  async checkHealth() {
    return fetchWithReliability("/api/health", { method: "GET" }, 1, 8000);
  },

  /**
   * System readiness probe
   */
  async checkReadiness() {
    return checkReadiness(2);
  },

  /**
   * Combined Overview Dashboard payload
   */
  async getDashboardOverview(hospitalState) {
    if (hospitalState) {
      return fetchWithReliability("/api/dashboard/overview", {
        method: "POST",
        body: JSON.stringify(hospitalState),
      }, 2, 30000);
    }
    return fetchWithReliability("/api/dashboard/overview", { method: "GET" }, 2, 30000);
  },

  /**
   * Patient Arrival Forecast (Deep Learning LSTM)
   */
  async getPatientForecast(hospitalState) {
    return fetchWithReliability("/api/predict/deep-learning", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    }, 2, 20000);
  },

  /**
   * Waiting Time Prediction (Supervised XGBoost Regressor)
   */
  async getWaitingTime(hospitalState) {
    return fetchWithReliability("/api/predict/waiting-time", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    }, 2, 20000);
  },

  /**
   * Crowding Risk Prediction (Supervised XGBoost Classifier)
   */
  async getCrowdingRisk(hospitalState) {
    return fetchWithReliability("/api/predict/crowding-risk", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    }, 2, 20000);
  },

  /**
   * Flow Pattern Discovery (Unsupervised K-Means + PCA)
   */
  async getFlowPatterns(hospitalState) {
    return fetchWithReliability("/api/patterns/flow", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    }, 2, 20000);
  },

  /**
   * Surge Anomaly Detection (Unsupervised DBSCAN)
   */
  async getSurgeDetection(hospitalState) {
    return fetchWithReliability("/api/surge/detect", {
      method: "POST",
      body: JSON.stringify(hospitalState || {}),
    }, 2, 20000);
  },

  async detectSurge(hospitalState) {
    return this.getSurgeDetection(hospitalState);
  },

  /**
   * AI Assistant Query Handler
   */
  async queryAIAssistant(question, hospitalState) {
    return fetchWithReliability("/api/ai-assistant/query", {
      method: "POST",
      body: JSON.stringify({
        question,
        hospital_state: hospitalState || null,
      }),
    }, 2, 25000);
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
    return fetchWithReliability("/api/monitoring", { method: "GET" }, 1, 10000);
  },
};
