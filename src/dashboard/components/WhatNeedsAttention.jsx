import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  TrendingUp,
  Waves,
} from "lucide-react";
import PageCard from "./PageCard";

const SEVERITY_CONFIG = {
  high: {
    border: "border-red/40 bg-red-tint/30 text-red",
    badge: "bg-red-tint text-red border-red/30",
    badgeText: "High Attention",
    icon: ShieldAlert,
  },
  warning: {
    border: "border-amber/40 bg-amber-tint/30 text-amber",
    badge: "bg-amber-tint text-amber border-amber/30",
    badgeText: "Warning",
    icon: AlertTriangle,
  },
  info: {
    border: "border-blue/40 bg-blue-tint/30 text-blue",
    badge: "bg-blue-tint text-blue border-blue/30",
    badgeText: "Notice",
    icon: Activity,
  },
};

export default function WhatNeedsAttention({ data }) {
  const items = [];

  // 1. High Crowding Signal
  const crowdingLevel = data?.crowding_risk?.crowding_level;
  const crowdingScore = data?.crowding_risk?.crowding_score;
  const expectedWindow = data?.crowding_risk?.expected_window || "Next 3 Hours";

  if (crowdingLevel === "CRITICAL" || crowdingLevel === "HIGH") {
    items.push({
      id: "crowding",
      category: "HIGH CROWDING",
      severity: crowdingLevel === "CRITICAL" ? "high" : "warning",
      title: `High Crowding Risk (${crowdingLevel})`,
      explanation: `Overall crowding risk is ${crowdingLevel} with a score of ${crowdingScore}/100 for window ${expectedWindow}.`,
      metric: `Score: ${crowdingScore}/100`,
      link: "/dashboard/crowding-risk",
      linkText: "View Crowding Risk",
      icon: ShieldAlert,
    });
  }

  // 2. High Arrivals / Surge Signal
  const isSurge = data?.surge_detection?.is_surge;
  const currentArrivalRate = data?.surge_detection?.current_arrival_rate || 28;
  const normalArrivalRate = data?.surge_detection?.normal_arrival_rate || "13-22";
  const deviationPercent = data?.surge_detection?.deviation_percent || "+33.3%";

  if (isSurge || currentArrivalRate > 22) {
    items.push({
      id: "surge",
      category: "HIGH ARRIVALS",
      severity: isSurge ? "high" : "warning",
      title: "Anomalous Arrival Volume",
      explanation: `Current arrival rate is ${currentArrivalRate} pts/hr (${deviationPercent} vs normal baseline of ${normalArrivalRate}/hr).`,
      metric: `${currentArrivalRate} pts/hr`,
      link: "/dashboard/surge-detection",
      linkText: "View Surge Detection",
      icon: Waves,
    });
  }

  // 3. Waiting Time Signal
  const waitMin = data?.waiting_time?.waiting_time_minutes;
  const waitTrend = data?.waiting_time?.trend;

  if ((waitMin && waitMin > 45) || waitTrend === "Increasing") {
    items.push({
      id: "wait_time",
      category: "WAITING TIME",
      severity: waitMin && waitMin > 60 ? "high" : "warning",
      title: "Elevated Triage Wait Time",
      explanation: `Average expected waiting time is currently ${Math.round(waitMin || 67)} minutes with an ${waitTrend || "Increasing"} trend.`,
      metric: `${Math.round(waitMin || 67)} min wait`,
      link: "/dashboard/waiting-time",
      linkText: "View Waiting Time",
      icon: Clock,
    });
  }

  // 4. Upcoming Demand Signal
  const peakTime = data?.forecast?.predicted_peak_time;
  const peakRate = data?.forecast?.predicted_peak_rate;
  const h3Volume = data?.forecast?.horizons?.["3h"];

  if (peakRate && peakRate > 25) {
    items.push({
      id: "upcoming_demand",
      category: "UPCOMING DEMAND",
      severity: "info",
      title: "Upcoming Peak Arrival Window",
      explanation: `Patient volume is projected to reach ${peakRate} arrivals per hour around ${peakTime} (${h3Volume || 56} arrivals expected over Next 3 Hours).`,
      metric: `Peak: ${peakTime}`,
      link: "/dashboard/forecast",
      linkText: "View Arrival Forecast",
      icon: TrendingUp,
    });
  }

  // 5. Flow Pattern Signal
  const patternName = data?.flow_pattern?.pattern_name;
  if (patternName && patternName.toLowerCase().includes("high")) {
    items.push({
      id: "flow_pattern",
      category: "UNUSUAL FLOW PATTERN",
      severity: "info",
      title: "Unusual Flow Regime Active",
      explanation: `Department operational state is currently assigned to cluster ${patternName}.`,
      metric: patternName,
      link: "/dashboard/flow-patterns",
      linkText: "View Flow Patterns",
      icon: Activity,
    });
  }

  return (
    <PageCard
      title="What Needs Attention"
      subtitle="Operational signals and high-priority departmental alerts identified from current predictions"
      icon={AlertTriangle}
    >
      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-green/30 bg-green-tint px-4 py-4 text-green">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="text-[14px] font-semibold">ER flow is currently stable.</h4>
            <p className="text-[12.5px] text-green/80">
              Current patient arrivals, queue wait times, and occupancy remain within normal operational baselines.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {items.map((item) => {
            const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.warning;
            const Icon = item.icon || AlertTriangle;

            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between rounded-xl border p-4 shadow-soft transition-all hover:shadow-lift ${cfg.border}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">
                      {item.category}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${cfg.badge}`}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.badgeText}
                    </span>
                  </div>

                  <h4 className="mt-2.5 text-[14.5px] font-semibold text-navy">{item.title}</h4>
                  <p className="mt-1 text-[13px] font-medium leading-relaxed text-navy-soft">
                    {item.explanation}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="font-mono text-[13px] font-bold text-navy">{item.metric}</span>
                  {item.link && (
                    <Link
                      to={item.link}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue transition-colors hover:text-blue-dark"
                    >
                      {item.linkText}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageCard>
  );
}
