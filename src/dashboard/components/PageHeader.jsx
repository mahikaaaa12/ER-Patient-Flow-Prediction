// Shared in-page heading used at the top of dashboard module pages.
// Keeps a consistent title/subtitle rhythm and an optional right-aligned
// action slot (e.g. time-range controls) across pages.
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-[20px] font-semibold tracking-tight text-navy sm:text-[22px]">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-navy-soft">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
