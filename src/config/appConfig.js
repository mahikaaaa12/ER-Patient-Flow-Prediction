const rawApiUrl = import.meta.env.VITE_API_BASE_URL;
const rawChatbotUrl = import.meta.env.VITE_CHATBOT_API_URL || rawApiUrl;

function getProductionFallbackUrl() {
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    if (hostname.includes("onrender.com")) {
      return "https://erflow-backend.onrender.com";
    }
  }
  return "https://erflow-backend.onrender.com";
}

const defaultApiBase = import.meta.env.DEV
  ? "http://localhost:8000"
  : getProductionFallbackUrl();

export const APP_CONFIG = {
  apiBaseUrl: (rawApiUrl || defaultApiBase).replace(/\/+$/, ""),
  chatbotApiUrl: (rawChatbotUrl || defaultApiBase).replace(/\/+$/, ""),
  defaultMode: import.meta.env.VITE_ERFLOW_APP_MODE || "REAL", // "REAL" | "DEMO"
};
