const rawApiUrl = import.meta.env.VITE_API_BASE_URL;
const rawChatbotUrl = import.meta.env.VITE_CHATBOT_API_URL || rawApiUrl;

if (!rawApiUrl && import.meta.env.PROD) {
  console.error(
    "[ERFlow API Error] VITE_API_BASE_URL environment variable is missing in production environment.\n" +
      "Please add VITE_API_BASE_URL to your Render environment variables pointing to your backend URL (e.g. https://erflow-backend.onrender.com)."
  );
}

export const APP_CONFIG = {
  apiBaseUrl: (rawApiUrl || (import.meta.env.DEV ? "http://localhost:8000" : "")).replace(/\/+$/, ""),
  chatbotApiUrl: (rawChatbotUrl || (import.meta.env.DEV ? "http://localhost:8000" : "")).replace(/\/+$/, ""),
  defaultMode: import.meta.env.VITE_ERFLOW_APP_MODE || "REAL", // "REAL" | "DEMO"
};
