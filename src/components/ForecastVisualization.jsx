import { Clock3, TrendingUp, Users } from "lucide-react";

// Static, frontend-only sample data. Hourly patient arrivals across a 24h
// window: the first 18 points are historical (observed), the last 6 are
// forecasted. Shape mirrors what a future forecasting endpoint would return.
const HOURS = [
  "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM",
  "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
  "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM",
  "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
];

const ARRIVALS = [
  9, 6, 5, 4, 5, 7,
  10, 14, 18, 22, 25, 27,
  29, 31, 28, 26, 30, 34,
  // forecasted from here (index 18 onward)
  39, 46, 42, 33, 24, 15,
];

const HISTORICAL_COUNT = 18;
const PEAK_INDEX = 19; // 7 PM label position, peak lands ~7:30 PM

const SUMMARY_CARDS = [
  { icon: Clock3, label: "Next Hour", value: "15", unit: "patients" },
  { icon: Clock3, label: "Next 3 Hours", value: "42", unit: "patients" },
  { icon: Clock3, label: "Next 6 Hours", value: "78", unit: "patients" },
  { icon: Users, label: "Next 24 Hours", value: "236", unit: "patients" },
];

function ArrivalsChart() {
  const width = 760;
  const height = 260;
  const paddingLeft = 36;
  const paddingBottom = 28;
  const paddingTop = 20;
  const plotWidth = width - paddingLeft - 8;
  const plotHeight = height - paddingTop - paddingBottom;

  const max = Math.max(...ARRIVALS);
  const step = plotWidth / (ARRIVALS.length - 1);

  const points = ARRIVALS.map((v, i) => {
    const x = paddingLeft + i * step;
    const y = paddingTop + (1 - v / max) * plotHeight;
    return [x, y];
  });

  const path = (pts) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const historicalPoints = points.slice(0, HISTORICAL_COUNT);
  // include one bridging point so the forecast line connects seamlessly
  const forecastPoints = points.slice(HISTORICAL_COUNT - 1);

  const historicalArea = `${path(historicalPoints)} L${historicalPoints[historicalPoints.length - 1][0].toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} L${paddingLeft},${(paddingTop + plotHeight).toFixed(1)} Z`;
  const forecastArea = `${path(forecastPoints)} L${forecastPoints[forecastPoints.length - 1][0].toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} L${forecastPoints[0][0].toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => paddingTop + f * plotHeight);
  const labelIndices = [0, 6, 12, 18, 23];
  const [peakX, peakY] = points[PEAK_INDEX];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      role="img"
      aria-label="Chart of hourly patient arrivals: solid line shows historical arrivals, dashed line shows forecasted arrivals, peaking around 7:30 PM."
    >
      <defs>
        <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-blue)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-blue)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="forecastFillArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines */}
      {gridLines.map((y) => (
        <line
          key={y}
          x1={paddingLeft}
          x2={width - 8}
          y1={y}
          y2={y}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
      ))}

      {/* Divider between observed and forecast range */}
      <line
        x1={historicalPoints[historicalPoints.length - 1][0]}
        x2={historicalPoints[historicalPoints.length - 1][0]}
        y1={paddingTop}
        y2={paddingTop + plotHeight}
        stroke="var(--color-border-strong)"
        strokeDasharray="2 3"
        strokeWidth="1"
      />

      {/* Areas */}
      <path d={historicalArea} fill="url(#histFill)" />
      <path d={forecastArea} fill="url(#forecastFillArea)" />

      {/* Historical line (observed) */}
      <path
        d={path(historicalPoints)}
        fill="none"
        stroke="var(--color-blue)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Forecast line (predicted) */}
      <path
        d={path(forecastPoints)}
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 4"
      />

      {/* Peak marker */}
      <circle cx={peakX} cy={peakY} r="4.5" fill="var(--color-teal)" stroke="white" strokeWidth="1.5" />
      <text
        x={peakX}
        y={peakY - 12}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="var(--color-navy)"
        fontFamily="var(--font-mono)"
      >
        Peak 7:30 PM
      </text>

      {/* X axis labels */}
      {labelIndices.map((i) => (
        <text
          key={i}
          x={points[i][0]}
          y={height - 8}
          textAnchor="middle"
          fontSize="11"
          fill="var(--color-navy-soft)"
        >
          {HOURS[i]}
        </text>
      ))}
    </svg>
  );
}

export default function ForecastVisualization() {
  return (
    <section id="forecast" className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-teal">
            Forecast Visualization
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            See Tomorrow's Patient Volume, Today
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            ERFlow projects expected patient arrivals hour by hour, clearly separating
            what already happened from what the model expects next.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-bg p-5 shadow-soft sm:p-6 lg:p-8">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wide text-navy-soft">
                24-Hour Arrivals Forecast
              </p>
              <p className="mt-0.5 text-sm text-navy-muted">Sample data for illustration only</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] font-medium text-navy-soft">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-blue" /> Historical
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="16" height="2" viewBox="0 0 16 2" aria-hidden="true">
                  <line x1="0" y1="1" x2="16" y2="1" stroke="var(--color-teal)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
                </svg>
                Forecasted
              </span>
            </div>
          </div>

          <div className="mt-6 h-56 w-full sm:h-64 lg:h-72">
            <ArrivalsChart />
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-teal/20 bg-teal-tint px-4 py-3">
            <TrendingUp className="h-4 w-4 shrink-0 text-teal" strokeWidth={2.25} aria-hidden="true" />
            <p className="text-[13px] leading-snug text-navy">
              <span className="font-semibold text-navy">Predicted Peak: 7:30 PM</span>
              {" "}— arrivals are expected to climb through the evening before easing off after 9 PM.
            </p>
          </div>
        </div>

        {/* Forecast summary cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SUMMARY_CARDS.map(({ icon: Icon, label, value, unit }) => (
            <div
              key={label}
              className="flex flex-col gap-2 rounded-xl border border-border bg-bg p-5 shadow-soft transition-shadow hover:shadow-lift"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-tint text-blue">
                <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[13px] font-medium text-navy-soft">{label}</p>
              <div className="flex items-end gap-1.5">
                <span className="font-mono text-2xl font-semibold text-navy sm:text-3xl">{value}</span>
                <span className="pb-0.5 text-[13px] text-navy-soft">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
