import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

const SEVERITY = {
  high: {
    label: "High Priority",
    icon: AlertOctagon,
    text: "text-red",
    bg: "bg-red-tint",
    border: "border-red/30",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    text: "text-amber-dark",
    bg: "bg-amber-tint",
    border: "border-amber/40",
  },
  info: {
    label: "Information",
    icon: Info,
    text: "text-blue",
    bg: "bg-blue-tint",
    border: "border-blue/30",
  },
};

export default function AlertCard({ severity = "info", title, detail }) {
  const s = SEVERITY[severity] || SEVERITY.info;
  const Icon = s.icon;

  return (
    <div className={`flex items-start gap-3 rounded-lg border ${s.border} ${s.bg} p-3.5`}>
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface ${s.text}`}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </span>
      <div>
        <p className={`text-[10.5px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-navy">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-navy-muted">{detail}</p>
      </div>
    </div>
  );
}
