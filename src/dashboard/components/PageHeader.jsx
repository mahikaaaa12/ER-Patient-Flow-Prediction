import { useEffect, useState } from "react";

export default function PageHeader({ section, title, subtitle, lastUpdated, action }) {
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const displayLastUpdated = lastUpdated || (timeStr ? `Last updated: ${timeStr}` : "");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-3 mb-2">
      <div>
        {section && (
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-navy-soft block mb-0.5">
            {section}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-navy">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13px] leading-relaxed text-navy-muted max-w-3xl">
            {subtitle}
          </p>
        )}
        {displayLastUpdated && (
          <p className="mt-1 font-mono text-[11.5px] text-navy-soft">
            {displayLastUpdated}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 mt-2 sm:mt-0">{action}</div>}
    </div>
  );
}
