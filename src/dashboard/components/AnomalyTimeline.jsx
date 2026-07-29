// Expected-vs-actual timeline chart that visually flags anomalous points
// (used by anomaly/surge detection style pages). `data` is an array of
// { t, expected, actual, anomaly? }.
export default function AnomalyTimeline({ data, height = 260 }) {
  const width = 100;
  const chartHeight = 100;
  const allValues = data.flatMap((d) => [d.expected, d.actual]);
  const max = Math.max(...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const toXY = (key, i) => {
    const x = i * step;
    const y = chartHeight - ((data[i][key] - min) / range) * chartHeight * 0.86 - 6;
    return [x, y];
  };

  const toPath = (key) =>
    data.map((_, i) => toXY(key, i)).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

  const firstAnomalyIndex = data.findIndex((d) => d.anomaly);

  return (
    <div>
      <div style={{ height }} className="w-full">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((g) => (
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

          {/* Shaded band behind the anomalous window */}
          {firstAnomalyIndex >= 0 && (
            <rect
              x={firstAnomalyIndex * step}
              y="0"
              width={width - firstAnomalyIndex * step}
              height={chartHeight}
              fill="var(--color-red)"
              fillOpacity="0.06"
            />
          )}

          <path d={toPath("expected")} fill="none" stroke="var(--color-navy-soft)" strokeWidth="1.6" strokeDasharray="3 2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={toPath("actual")} fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

          {data.map((d, i) => {
            const [x, y] = toXY("actual", i);
            return d.anomaly ? (
              <g key={d.t}>
                <circle cx={x} cy={y} r="3.2" fill="var(--color-red)" fillOpacity="0.18" />
                <circle cx={x} cy={y} r="1.5" fill="var(--color-red)" stroke="var(--color-surface)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
              </g>
            ) : (
              <circle key={d.t} cx={x} cy={y} r="1.1" fill="var(--color-red)" vectorEffect="non-scaling-stroke" />
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex justify-between text-[10.5px] font-medium text-navy-soft sm:text-[11px]">
        {data.map((d) => (
          <span key={d.t}>{d.t}</span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-medium text-navy-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full border-t border-dashed border-navy-soft" />
          Expected baseline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-red" />
          Actual arrivals
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red" />
          Anomalous period
        </span>
      </div>
    </div>
  );
}
