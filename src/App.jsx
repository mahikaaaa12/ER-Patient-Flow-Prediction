import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardLayout from "./dashboard/DashboardLayout";
import Overview from "./dashboard/pages/Overview";
import PatientForecast from "./dashboard/pages/PatientForecast";
import WaitingTime from "./dashboard/pages/WaitingTime";
import CrowdingRisk from "./dashboard/pages/CrowdingRisk";
import FlowPatterns from "./dashboard/pages/FlowPatterns";
import SurgeDetection from "./dashboard/pages/SurgeDetection";
import AIAssistant from "./dashboard/pages/AIAssistant";
import NotFound from "./pages/NotFound";
import { ModeProvider } from "./context/ModeContext";

function App() {
  return (
    <ModeProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="forecast" element={<PatientForecast />} />
          <Route path="waiting-time" element={<WaitingTime />} />
          <Route path="crowding-risk" element={<CrowdingRisk />} />
          <Route path="flow-patterns" element={<FlowPatterns />} />
          <Route path="surge-detection" element={<SurgeDetection />} />
          <Route path="ai-assistant" element={<AIAssistant />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ModeProvider>
  );
}

export default App;
