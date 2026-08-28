import React, { createContext, useContext, useState } from "react";
import { APP_CONFIG } from "../config/appConfig";

const ModeContext = createContext({
  mode: "REAL", // "REAL" | "DEMO"
  setMode: () => {},
  toggleMode: () => {},
  isRealMode: true,
  isDemoMode: false,
});

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem("erflow_app_mode") || APP_CONFIG.defaultMode;
  });

  const setMode = (newMode) => {
    setModeState(newMode);
    localStorage.setItem("erflow_app_mode", newMode);
  };

  const toggleMode = () => {
    setMode(mode === "REAL" ? "DEMO" : "REAL");
  };

  const value = {
    mode,
    setMode,
    toggleMode,
    isRealMode: mode === "REAL",
    isDemoMode: mode === "DEMO",
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
