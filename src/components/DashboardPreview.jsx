import { AlertTriangle, Clock, TrendingUp, Users } from "lucide-react";

// Static sample data — shape mirrors what a future /api/forecast response
// would return, so this can be swapped for live data without restructuring
// the markup below.
const DASHBOARD_DATA = {
  department: "Emergency Department",
  status: "High Demand",
  occupancy: {
    current: 78,
    label: "Current Occupancy",
  },
  arrivals: [
    { window: "1h", label: "Next 1 hour", count: 15 },
    { window: "3h", label: "Next 3 hours", count: 42 },
    { window: "6h", label: "Next 6 hours", count: 78 },
    { window: "24h", label: "Next 24 hours", count: 236 },
  ],
  expectedWaitMinutes: 48,
  crowdingRisk: "HIGH",
  nextPeak: { start: "6:00 PM", end: "9:00 PM" },
  forecastSeries: [18, 22, 19, 26, 31, 28, 35, 42, 39, 48, 58, 78],
  alert: {
    title: "Patient Surge Expected",
    detail: "Demand is predicted to increase by 34% over the next 3 hours.",
  },
};

function riskTone(risk) {
  if (risk === "HIGH") return { text: "text-red", bg: "bg-red-tint", dot: "bg-red" };
  if (risk === "MODERATE") return { text: "text-amber", bg: "bg-amber-tint", dot: "bg-amber" };
  return { text: "text-green", bg: "bg-green-tint", dot: "bg-green" };
}

function statusTone(status) {
  if (status === "High Demand" || status === "Critical") {
    return { text: "text-red", bg: "bg-red-tint", dot: "bg-red" };
  }
  if (status === "Elevated") {
    return { text: "text-amber", bg: "bg-amber-tint", dot: "bg-amber" };
  }
  return { text: "text-green", bg: "bg-green-tint", dot: "bg-green" };
}

function ForecastChart({ series }) {
  const width = 100;
  const height = 100;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const step = width / (series.length - 1);

  const points = series.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height * 0.82 - 6;
    return [x, y];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  // Split into "observed" vs "predicted" segment — last 4 points are forecast
  const splitIndex = series.length - 4;
  const predictedPath = points
    .slice(splitIndex)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-blue)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#forecastFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--color-blue)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={predictedPath}
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function DashboardPreview() {
  const risk = riskTone(DASHBOARD_DATA.crowdingRisk);
  const status = statusTone(DASHBOARD_DATA.status);

  return (
    <div
      id="dashboard"
      className="relative w-full max-w-md rounded-2xl border border-border bg-surface shadow-lift lg:max-w-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-navy-soft">
            {DASHBOARD_DATA.department}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-navy">
            ER Status: {DASHBOARD_DATA.status}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${status.bg} ${status.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full animate-soft-pulse ${status.dot}`} />
          {DASHBOARD_DATA.status}
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Occupancy + Wait row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-center gap-1.5 text-navy-soft">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[12px] font-medium uppercase tracking-wide">
                {DASHBOARD_DATA.occupancy.label}
              </span>
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="font-mono text-3xl font-semibold text-navy">
                {DASHBOARD_DATA.occupancy.current}
              </span>
              <span className="pb-1 font-mono text-lg text-navy-soft">%</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-blue"
                style={{ width: `${DASHBOARD_DATA.occupancy.current}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-center gap-1.5 text-navy-soft">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[12px] font-medium uppercase tracking-wide">Expected Wait</span>
            </div>
            <div className="mt-2 flex items-end gap-1">
              <span className="font-mono text-3xl font-semibold text-navy">
                {DASHBOARD_DATA.expectedWaitMinutes}
              </span>
              <span className="pb-1 text-sm text-navy-soft">min</span>
            </div>
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold ${risk.bg} ${risk.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
              Crowding Risk: {DASHBOARD_DATA.crowdingRisk}
            </div>
          </div>
        </div>

        {/* Predicted arrivals */}
        <div className="rounded-xl border border-border bg-bg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-navy-soft">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-[12px] font-medium uppercase tracking-wide">
                Predicted Arrivals
              </span>
            </div>
            <span className="text-[12px] font-medium text-navy-soft">
              Peak {DASHBOARD_DATA.nextPeak.start}–{DASHBOARD_DATA.nextPeak.end}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DASHBOARD_DATA.arrivals.map((a) => (
              <div key={a.window} className="rounded-lg bg-surface border border-border px-3 py-2.5 text-center">
                <p className="font-mono text-xl font-semibold text-navy">{a.count}</p>
                <p className="mt-0.5 text-[11px] font-medium text-navy-soft">{a.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 h-16 w-full">
            <ForecastChart series={DASHBOARD_DATA.forecastSeries} />
          </div>
          <div className="mt-1 flex items-center gap-4 text-[11px] font-medium text-navy-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-blue" /> Observed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-teal" /> Predicted
            </span>
          </div>
        </div>

        {/* Alert */}
        <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber-tint p-4">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-navy">{DASHBOARD_DATA.alert.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-navy-muted">
              {DASHBOARD_DATA.alert.detail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
