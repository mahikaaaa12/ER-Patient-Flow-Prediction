// Semi-circular gauge, 0-100. Pure SVG, no dependencies.
export default function RiskGauge({ score, label }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 78;
  const startAngle = 180;
  const endAngle = 0;
  const angle = startAngle - (score / 100) * (startAngle - endAngle);

  const toXY = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };

  const [needleX, needleY] = toXY(angle);

  const arcPath = (a1, a2) => {
    const [x1, y1] = toXY(a1);
    const [x2, y2] = toXY(a2);
    const largeArc = Math.abs(a1 - a2) > 180 ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 0 ${x2},${y2}`;
  };

  const color = score >= 70 ? "var(--color-red)" : score >= 40 ? "var(--color-amber)" : "var(--color-green)";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size * 0.6}`} className="w-full max-w-[240px]" aria-hidden="true">
        <path d={arcPath(180, 0)} stroke="var(--color-border)" strokeWidth="14" fill="none" strokeLinecap="round" />
        <path d={arcPath(180, angle)} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="var(--color-navy)" />
      </svg>
      <p className="-mt-6 font-mono text-4xl font-semibold text-navy">{score}</p>
      {label && <p className="mt-1 text-[13px] font-medium text-navy-soft">{label}</p>}
    </div>
  );
}
