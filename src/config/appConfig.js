export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  chatbotApiUrl: import.meta.env.VITE_CHATBOT_API_URL || "http://localhost:8000",
  defaultMode: import.meta.env.VITE_ERFLOW_APP_MODE || "REAL", // "REAL" | "DEMO"
};
