const TONE_VAR = {
  green: "var(--color-green)",
  amber: "var(--color-amber)",
  blue: "var(--color-blue)",
  red: "var(--color-red)",
  teal: "var(--color-teal)",
  navy: "var(--color-navy)",
};

// Static, frontend-only 2D scatter visualization used to represent
// clustered groups (e.g. K-Means output). Points and cluster centers are
// supplied as plain { x, y } coordinates on a 0-100 scale.
export default function ClusterScatter({
  clusters,
  points,
  currentPoint,
  xLabel = "Arrival Volume",
  yLabel = "System Strain",
  height = 280,
}) {
  const toneFor = (clusterId) => {
    const cluster = clusters.find((c) => c.id === clusterId);
    return TONE_VAR[cluster?.tone] || TONE_VAR.navy;
  };

  return (
    <div>
      <div style={{ height }} className="relative w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((g) => (
            <g key={g}>
              <line x1="0" x2="100" y1={100 * g} y2={100 * g} stroke="var(--color-border)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
              <line x1={100 * g} x2={100 * g} y1="0" y2="100" stroke="var(--color-border)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          <line x1="0" x2="100" y1="100" y2="100" stroke="var(--color-border-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2="0" y1="0" y2="100" stroke="var(--color-border-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />

          {points.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={100 - p.y}
              r="1.7"
              fill={toneFor(p.clusterId)}
              fillOpacity="0.55"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {currentPoint && (
            <g>
              <circle cx={currentPoint.x} cy={100 - currentPoint.y} r="4.2" fill="none" stroke={toneFor(currentPoint.clusterId)} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx={currentPoint.x} cy={100 - currentPoint.y} r="2.4" fill="var(--color-navy)" stroke="var(--color-surface)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
          )}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10.5px] font-medium text-navy-soft">
        <span>{xLabel} →</span>
        <span className="rotate-0">{yLabel} ↑</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] font-medium text-navy-soft">
        {clusters.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: TONE_VAR[c.tone] }} />
            {c.name}
          </span>
        ))}
        {currentPoint && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-surface bg-navy" />
            Today
          </span>
        )}
      </div>
    </div>
  );
}
