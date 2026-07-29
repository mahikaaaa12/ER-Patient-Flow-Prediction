// Reusable area/line chart built with plain SVG (no charting library).
// `data` is an array of { t: string, value: number, kind?: "observed"|"forecast" }.
// When entries carry a `kind`, the line is split visually into a solid
// "observed" segment and a dashed "forecast" segment.
export default function TrendChart({
  data,
  height = 220,
  color = "var(--color-blue)",
  forecastColor = "var(--color-teal)",
  showLegend = true,
  valueSuffix = "",
  tickEvery,
  historicalLabel = "Observed",
}) {
  const width = 100;
  const chartHeight = 100;
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * step;
    const y = chartHeight - ((d.value - min) / range) * chartHeight * 0.86 - 6;
    return [x, y];
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${path} L${width},${chartHeight} L0,${chartHeight} Z`;

  const hasForecast = data.some((d) => d.kind === "forecast");
  const splitIndex = hasForecast ? data.findIndex((d) => d.kind === "forecast") : -1;

  const observedPath =
    splitIndex > 0
      ? points
          .slice(0, splitIndex + 1)
          .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" ")
      : path;

  const forecastPath =
    splitIndex >= 0
      ? points
          .slice(splitIndex)
          .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" ")
      : null;

  const gridLines = [0.25, 0.5, 0.75];
  const gap = tickEvery || Math.ceil(data.length / 6);
  const tickIndices = data
    .map((_, i) => i)
    .filter((i) => i % gap === 0 || i === data.length - 1);

  return (
    <div>
      <div style={{ height }} className="w-full">
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridLines.map((g) => (
            <line
              key={g}
              x1="0"
              x2={width}
              y1={chartHeight * g}
              y2={chartHeight * g}
              stroke="var(--color-border)"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={areaPath} fill="url(#trendFill)" />
          <path
            d={observedPath}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke={forecastColor}
              strokeWidth="1.8"
              strokeDasharray="3 2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] font-medium text-navy-soft sm:text-[11px]">
        {tickIndices.map((i) => (
          <span key={i}>{data[i].t}</span>
        ))}
      </div>

      {showLegend && (
        <div className="mt-2 flex items-center gap-4 text-[11px] font-medium text-navy-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
            {hasForecast ? historicalLabel : "Value"}
            {valueSuffix}
          </span>
          {hasForecast && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: forecastColor }} />
              Forecast
            </span>
          )}
        </div>
      )}
    </div>
  );
}
