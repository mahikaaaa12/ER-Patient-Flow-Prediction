import { Activity, AlertTriangle, ArrowRight, Clock, Users } from "lucide-react";

export default function PatientFlowPipeline({ data }) {
  const arrRate = data?.surge_detection?.current_arrival_rate || 28;
  const normalRate = data?.surge_detection?.normal_arrival_rate || "13–22";
  const isSurge = data?.surge_detection?.is_surge ?? true;

  const waitMin = data?.waiting_time?.waiting_time_minutes ? Math.round(data.waiting_time.waiting_time_minutes) : 67;
  const waitTrend = data?.waiting_time?.trend || "Increasing";
  const triageLevel = data?.waiting_time?.triage_level || "Standard";

  const crowdingLevel = data?.crowding_risk?.crowding_level || "CRITICAL";
  const crowdingScore = data?.crowding_risk?.crowding_score ?? 25;

  const surgeStatus = data?.surge_detection?.status || "ANOMALOUS SURGE DETECTED";
  const surgeSeverity = data?.surge_detection?.severity || "Moderate";

  const stages = [
    {
      id: "inflow",
      step: "01",
      label: "Patient Inflow",
      metric: `${arrRate} pts/hr`,
      subtitle: `Baseline: ${normalRate}/hr`,
      badge: isSurge ? "High Inflow" : "Normal Inflow",
      badgeTone: isSurge ? "amber" : "green",
      icon: Users,
    },
    {
      id: "triage",
      step: "02",
      label: "Triage & Queue",
      metric: `${waitMin} min avg wait`,
      subtitle: `${triageLevel} Acuity Level`,
      badge: waitTrend === "Increasing" ? "Queue Growing" : "Queue Stable",
      badgeTone: waitTrend === "Increasing" ? "amber" : "green",
      icon: Clock,
    },
    {
      id: "capacity",
      step: "03",
      label: "Department Strain",
      metric: `${crowdingLevel} Risk`,
      subtitle: `Index Score: ${crowdingScore}/100`,
      badge: crowdingLevel === "CRITICAL" || crowdingLevel === "HIGH" ? "High Strain" : "Moderate Strain",
      badgeTone: crowdingLevel === "CRITICAL" ? "red" : "amber",
      icon: Activity,
    },
    {
      id: "surge",
      step: "04",
      label: "Surge Threat Status",
      metric: surgeStatus,
      subtitle: `Severity: ${surgeSeverity}`,
      badge: isSurge ? "Attention Needed" : "Normal Load",
      badgeTone: isSurge ? "red" : "green",
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-navy">Patient Flow Journey Pipeline</h3>
          <p className="mt-0.5 text-[12.5px] text-navy-soft">
            Live 4-stage operational flow tracking from patient arrival to surge resolution
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue/20 bg-blue-tint px-3 py-1 text-[12px] font-semibold text-blue">
          <Activity className="h-3.5 w-3.5" /> Live Operational Journey
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const toneClasses = {
            green: "bg-green-tint text-green border-green/30",
            amber: "bg-amber-tint text-amber border-amber/30",
            red: "bg-red-tint text-red border-red/30",
            blue: "bg-blue-tint text-blue border-blue/30",
          };

          return (
            <div
              key={stage.id}
              className="relative flex flex-col justify-between rounded-xl border border-border bg-bg p-4 transition-all hover:border-border-strong"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-navy-soft">STAGE {stage.step}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      toneClasses[stage.badgeTone]
                    }`}
                  >
                    {stage.badge}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-navy shadow-soft">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <h4 className="text-[13.5px] font-semibold text-navy">{stage.label}</h4>
                </div>
                <p className="mt-2.5 text-[16px] font-bold tracking-tight text-navy">{stage.metric}</p>
                <p className="mt-0.5 text-[12px] font-medium text-navy-soft">{stage.subtitle}</p>
              </div>

              {idx < stages.length - 1 && (
                <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 z-10 xl:block">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-navy-muted shadow-soft">
                    <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
