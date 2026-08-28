const TONE_BAR = {
  blue: "bg-blue",
  teal: "bg-teal",
  green: "bg-green",
  amber: "bg-amber",
  red: "bg-red",
  navy: "bg-navy",
};

// items: [{ label, value, max?, tone, valueLabel? }]
export default function BarList({ items, defaultMax }) {
  const max = defaultMax || Math.max(...items.map((i) => i.max || i.value));

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => {
        const pct = Math.min(100, (item.value / (item.max || max)) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-medium text-navy">{item.label}</span>
              <span className="shrink-0 font-mono text-[13px] font-semibold text-navy-muted">
                {item.valueLabel ?? item.value}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg border border-border">
              <div
                className={`h-full rounded-full ${TONE_BAR[item.tone] || TONE_BAR.blue}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
