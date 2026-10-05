export default function PageCard({ title, subtitle, action, icon: Icon, children, className = "" }) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 shadow-soft sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-start gap-2.5">
            {Icon && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-blue">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
            )}
            <div>
              {title && <h3 className="text-[15px] font-semibold tracking-tight text-navy">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-[12px] font-normal text-navy-soft">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
