import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DesktopSidebar, MobileSidebar } from "./Sidebar";
import Header from "./Header";

const PAGE_META = {
  "/dashboard": {
    title: "Overview",
    subtitle: "Live snapshot of current ER demand and operational risk",
  },
  "/dashboard/forecast": {
    title: "Patient Forecast",
    subtitle: "Predicted patient arrivals across the next 24 hours",
  },
  "/dashboard/waiting-time": {
    title: "Waiting Time",
    subtitle: "Current and projected waiting times by triage level",
  },
  "/dashboard/crowding-risk": {
    title: "Crowding Risk",
    subtitle: "Real-time crowding score and contributing factors",
  },
  "/dashboard/flow-patterns": {
    title: "Flow Patterns",
    subtitle: "Detected demand patterns and typical patient flow stages",
  },
  "/dashboard/surge-detection": {
    title: "Surge Detection",
    subtitle: "Anomaly detection for unexpected patient volume",
  },
  "/dashboard/ai-assistant": {
    title: "AI Assistant",
    subtitle: "Ask plain-language questions about current ER conditions",
  },
};

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const meta = PAGE_META[location.pathname] || PAGE_META["/dashboard"];

  return (
    <div className="flex min-h-svh w-full bg-bg">
      <DesktopSidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onToggleDesktopSidebar={() => setCollapsed((v) => !v)}
          sidebarCollapsed={collapsed}
        />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
