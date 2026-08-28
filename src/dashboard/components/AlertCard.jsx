import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

const SEVERITY = {
  high: {
    label: "High Priority",
    icon: AlertOctagon,
    text: "text-red",
    bg: "bg-red-tint",
    border: "border-red/25",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    text: "text-amber",
    bg: "bg-amber-tint",
    border: "border-amber/25",
  },
  info: {
    label: "Information",
    icon: Info,
    text: "text-blue",
    bg: "bg-blue-tint",
    border: "border-blue/25",
  },
};

export default function AlertCard({ severity = "info", title, detail }) {
  const s = SEVERITY[severity] || SEVERITY.info;
  const Icon = s.icon;

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} p-4`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface ${s.text}`}>
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div>
        <p className={`text-[11px] font-semibold uppercase tracking-wide ${s.text}`}>{s.label}</p>
        <p className="mt-0.5 text-[14.5px] font-semibold text-navy">{title}</p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-navy-muted">{detail}</p>
      </div>
    </div>
  );
}
