export default function PageCard({ title, subtitle, action, icon: Icon, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 shadow-soft sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-tint text-blue">
                <Icon className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
            )}
            <div>
              {title && <h3 className="text-[16px] font-semibold text-navy">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-[13px] text-navy-soft">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
