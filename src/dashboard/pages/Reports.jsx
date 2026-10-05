import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import MetricCard from "../components/MetricCard";
import ModelBadge from "../components/ModelBadge";
import StatusBadge from "../components/StatusBadge";
import CentralContextBanner from "../components/CentralContextBanner";
import { useMode } from "../../context/ModeContext";
import { useERContext } from "../../context/ERContext";

const SHIFT_OPTIONS = [
  { id: "current", label: "Current Shift (Active)" },
  { id: "morning", label: "Morning Shift (07:00 - 15:00)" },
  { id: "evening", label: "Evening Shift (15:00 - 23:00)" },
  { id: "night", label: "Night Shift (23:00 - 07:00)" },
];

export default function Reports() {
  const { isRealMode, isDemoMode } = useMode();
  const { operationalState, predictions } = useERContext();
  const [selectedShift, setSelectedShift] = useState("current");
  const [exporting, setExporting] = useState(false);

  const timestamp = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    setExporting(true);
    setTimeout(() => {
      const csvContent =
        "data:text/csv;charset=utf-8," +
        "Metric,Value,Baseline,Status\n" +
        `Occupancy,${operationalState.occupancy_percent}%,75%,Active\n` +
        `Patients Waiting,${operationalState.patients_waiting},20,Active\n` +
        `Arrival Rate,${operationalState.arrival_rate} pts/hr,28 pts/hr,Active\n` +
        `Available Beds,${operationalState.available_beds},12,Active\n` +
        `Expected Wait Time,${Math.round(predictions?.waiting_time?.waiting_time_minutes || 42)} min,30 min,Evaluated\n`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ER_Operational_Report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExporting(false);
    }, 500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Demo Mode Notice */}
      {isDemoMode && (
        <div className="flex items-center justify-between rounded-lg border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] text-amber-dark">
          <div className="flex items-center gap-2 font-medium">
            <span className="rounded bg-amber px-2 py-0.5 text-[11px] font-bold text-white uppercase">
              DEMO MODE
            </span>
            <span>Displaying synthetic shift report metrics. Switch to REAL ML MODE in the header for live report generation.</span>
          </div>
        </div>
      )}

      <PageHeader
        section="TELEMETRY & REPORTS"
        title="Shift & Operational Reports"
        subtitle="Shift summaries, throughput compliance, bed occupancy metrics, and ML prediction telemetry reports."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-navy hover:bg-bg transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-blue-dark transition-colors disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        }
      />

      <CentralContextBanner moduleName="Operational Shift Reports" />

      {/* SHIFT SELECTOR CONTROLS */}
      <div className="rounded-lg border border-border bg-surface p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-[14.5px] font-bold text-navy">Select Shift Window</h3>
            <p className="text-[12px] text-navy-soft">
              Report generated at: <span className="font-mono font-bold text-navy">{timestamp}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SHIFT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedShift(opt.id)}
                className={`rounded-md border px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                  selectedShift === opt.id
                    ? "border-blue bg-blue-tint text-blue shadow-soft"
                    : "border-border bg-bg text-navy-soft hover:bg-surface"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SHIFT SUMMARY METRICS PILLARS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Inflow Volume"
          value={`${operationalState.arrival_rate * 8} patients`}
          unit="shift total"
          tone="blue"
        />
        <MetricCard
          label="Avg Wait Time"
          value={`${Math.round(predictions?.waiting_time?.waiting_time_minutes || 42)} min`}
          unit="triage estimate"
          tone="amber"
        />
        <MetricCard
          label="Peak Occupancy"
          value={`${operationalState.occupancy_percent}%`}
          unit="capacity max"
          tone={operationalState.occupancy_percent > 85 ? "red" : "teal"}
        />
        <MetricCard
          label="Crowding Threat Level"
          value={predictions?.crowding_risk?.crowding_level || "MODERATE"}
          unit="evaluated score"
          tone={predictions?.crowding_risk?.crowding_level === "HIGH" ? "amber" : "teal"}
        />
      </div>

      {/* DETAILED OPERATIONAL TABLE */}
      <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-soft">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div>
            <span className="text-[11.5px] font-bold tracking-wider text-navy-soft uppercase">
              Throughput & Resource Utilization Log
            </span>
            <h2 className="text-xl font-bold tracking-tight text-navy">Operational Metrics Detail</h2>
          </div>
          <StatusBadge label="Grounded Telemetry" tone="teal" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-navy-soft text-[11.5px] font-bold uppercase tracking-wider bg-bg">
                <th className="py-3 px-4">Operational Category</th>
                <th className="py-3 px-4">Observed Metric</th>
                <th className="py-3 px-4">Target Baseline</th>
                <th className="py-3 px-4">Variance</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">ER Bed Occupancy</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.occupancy_percent}%</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">75.0%</td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-dark">+{operationalState.occupancy_percent - 75}%</td>
                <td className="py-3.5 px-4"><StatusBadge label="Elevated" tone="amber" /></td>
              </tr>
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">Triage Queue Volume</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.patients_waiting} Patients</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">15 Patients</td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-dark">+{operationalState.patients_waiting - 15}</td>
                <td className="py-3.5 px-4"><StatusBadge label="Queue Active" tone="amber" /></td>
              </tr>
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">Patient Arrival Velocity</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.arrival_rate} /hr</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">20 /hr</td>
                <td className="py-3.5 px-4 font-mono font-bold text-teal">+{operationalState.arrival_rate - 20} /hr</td>
                <td className="py-3.5 px-4"><StatusBadge label="Normal" tone="green" /></td>
              </tr>
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">Available Treatment Beds</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.available_beds} Beds</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">12 Beds</td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-dark">-{12 - operationalState.available_beds}</td>
                <td className="py-3.5 px-4"><StatusBadge label={operationalState.available_beds <= 4 ? "Low" : "Ready"} tone={operationalState.available_beds <= 4 ? "amber" : "green"} /></td>
              </tr>
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">Physician Staffing Ratio</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.available_doctors} MD/DO</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">5 MD/DO</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy-soft">Optimal</td>
                <td className="py-3.5 px-4"><StatusBadge label="On Shift" tone="teal" /></td>
              </tr>
              <tr className="hover:bg-bg/50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-navy">Nurse Staffing Ratio</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy">{operationalState.available_nurses} RN/BSN</td>
                <td className="py-3.5 px-4 font-mono text-navy-muted">10 RN/BSN</td>
                <td className="py-3.5 px-4 font-mono font-bold text-navy-soft">Optimal</td>
                <td className="py-3.5 px-4"><StatusBadge label="On Shift" tone="teal" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
