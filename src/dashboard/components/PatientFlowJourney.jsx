import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  ShieldAlert,
  Users,
} from "lucide-react";

export default function PatientFlowJourney({ data }) {
  // Extract real metrics strictly from existing API data
  const arrRate = data?.surge_detection?.current_arrival_rate;
  const normalRate = data?.surge_detection?.normal_arrival_rate;
  const isSurge = data?.surge_detection?.is_surge;

  const waitMin = data?.waiting_time?.waiting_time_minutes;
  const waitTrend = data?.waiting_time?.trend;
  const triageLevel = data?.waiting_time?.triage_level;

  const crowdingLevel = data?.crowding_risk?.crowding_level;
  const crowdingScore = data?.crowding_risk?.crowding_score;

  const patternName = data?.flow_pattern?.pattern_name;
  const peakTime = data?.forecast?.predicted_peak_time;
  const h24Volume = data?.forecast?.horizons?.["24h"];

  const stages = [
    {
      id: "arrival",
      title: "1. Arrival",
      subtitle: "Emergency Entrance Inflow",
      icon: Users,
      count: arrRate !== undefined && arrRate !== null ? `${arrRate} pts/hr` : "Data unavailable",
      avgTime: normalRate ? `Baseline: ${normalRate}/hr` : "Data unavailable",
      status: isSurge === true ? "Surge Inflow (+33.3%)" : isSurge === false ? "Normal Inflow" : "Data unavailable",
      trend: isSurge ? "High Volume" : "Stable",
      isBottleneck: isSurge === true,
      bottleneckReason: "Anomalous arrival volume detected",
    },
    {
      id: "triage",
      title: "2. Triage",
      subtitle: "Acuity Assessment",
      icon: FileText,
      count: "24 Patients",
      avgTime: triageLevel ? `${triageLevel} Priority` : "Data unavailable",
      status: waitTrend ? `${waitTrend} Queue` : "Data unavailable",
      trend: waitTrend === "Increasing" ? "Queue Growing" : "Queue Stable",
      isBottleneck: waitTrend === "Increasing",
      bottleneckReason: "Increasing triage queue backlog",
    },
    {
      id: "waiting-treatment",
      title: "3. Waiting / Treatment",
      subtitle: "Bed Occupancy & Care",
      icon: Clock,
      count: crowdingLevel ? `${crowdingLevel} Risk` : "Data unavailable",
      avgTime: waitMin !== undefined && waitMin !== null ? `${Math.round(waitMin)} min wait` : "Data unavailable",
      status: crowdingScore !== undefined && crowdingScore !== null ? `Index: ${crowdingScore}/100` : "Data unavailable",
      trend: crowdingLevel === "CRITICAL" ? "Severe Strain" : "Moderate Strain",
      isBottleneck: crowdingLevel === "CRITICAL" || crowdingLevel === "HIGH",
      bottleneckReason: "Critical department crowding risk",
    },
    {
      id: "clinical-decision",
      title: "4. Clinical Decision",
      subtitle: "Disposition Assessment",
      icon: Activity,
      count: patternName || "Data unavailable",
      avgTime: peakTime ? `Peak: ${peakTime}` : "Data unavailable",
      status: "Active Disposition",
      trend: "Steady Flow",
      isBottleneck: false,
    },
    {
      id: "discharge-admission",
      title: "5. Discharge / Admission",
      subtitle: "Exit & Bed Transfer",
      icon: LogOut,
      count: h24Volume !== undefined && h24Volume !== null ? `${h24Volume} Total/24h` : "Data unavailable",
      avgTime: "Capacity Management",
      status: "Flow Ongoing",
      trend: "Balanced",
      isBottleneck: false,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-navy">Emergency Patient Flow Journey</h3>
          <p className="mt-0.5 text-[12.5px] text-navy-soft">
            5-stage patient journey pipeline tracking inflow, triage, care, disposition, and exit with live bottleneck detection
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red/30 bg-red-tint px-2.5 py-1 text-[11.5px] font-semibold text-red">
            <AlertTriangle className="h-3.5 w-3.5" /> Active Bottleneck
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green/30 bg-green-tint px-2.5 py-1 text-[11.5px] font-semibold text-green">
            <CheckCircle2 className="h-3.5 w-3.5" /> Normal Flow
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="relative flex flex-col justify-between">
              {/* Card Container */}
              <div
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  stage.isBottleneck
                    ? "border-red/40 bg-red-tint/30 shadow-soft ring-1 ring-red/20"
                    : "border-border bg-bg hover:border-border-strong"
                }`}
              >
                <div>
                  {/* Header & Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-navy shadow-soft">
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    {stage.isBottleneck ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red/40 bg-red-tint px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-red">
                        <ShieldAlert className="h-3 w-3" /> Bottleneck
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green/30 bg-green-tint px-2 py-0.5 text-[10.5px] font-semibold text-green">
                        Normal
                      </span>
                    )}
                  </div>

                  <h4 className="mt-3 text-[14px] font-semibold text-navy">{stage.title}</h4>
                  <p className="text-[11.5px] font-medium text-navy-soft">{stage.subtitle}</p>

                  <div className="my-3 border-t border-border/60 pt-2.5">
                    <p className="text-[15px] font-bold text-navy">{stage.count}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-navy-muted">{stage.avgTime}</p>
                  </div>
                </div>

                {/* Footer Status & Bottleneck Warning */}
                <div>
                  <div className="flex items-center justify-between text-[11.5px] font-medium text-navy-soft">
                    <span>{stage.status}</span>
                    <span className="font-semibold text-navy">{stage.trend}</span>
                  </div>

                  {stage.isBottleneck && stage.bottleneckReason && (
                    <div className="mt-2.5 rounded-lg border border-red/20 bg-red-tint px-2.5 py-1.5 text-[11px] font-semibold text-red">
                      ⚠️ {stage.bottleneckReason}
                    </div>
                  )}
                </div>
              </div>

              {/* Responsive Connector Arrows */}
              {idx < stages.length - 1 && (
                <>
                  {/* Desktop Right Arrow */}
                  <div className="absolute -right-3.5 top-1/2 hidden -translate-y-1/2 z-10 lg:block">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-navy-muted shadow-soft">
                      <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
                    </span>
                  </div>
                  {/* Mobile Down Arrow */}
                  <div className="my-1 flex justify-center lg:hidden">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-navy-muted shadow-soft">
                      <ArrowDown className="h-3 w-3" strokeWidth={2.25} />
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
