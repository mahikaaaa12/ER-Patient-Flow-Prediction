import { useEffect, useRef, useState } from "react";
import { Bell, Menu, PanelLeftOpen } from "lucide-react";
import { NOTIFICATIONS, SYSTEM_STATUS } from "./mockData";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatDateTime(date) {
  const datePart = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  return { datePart, timePart };
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-navy-muted transition-colors hover:bg-bg"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[calc(100vw-2rem)] max-w-[340px] rounded-xl border border-border bg-surface shadow-lift">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[14px] font-semibold text-navy">Notifications</p>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id} className="border-b border-border px-4 py-3 last:border-b-0">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      n.unread ? "bg-blue" : "bg-border-strong"
                    }`}
                  />
                  <div>
                    <p className="text-[13.5px] font-semibold text-navy">{n.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-navy-muted">{n.detail}</p>
                    <p className="mt-1 text-[11px] font-medium text-navy-soft">{n.time}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SystemStatus() {
  const ok = SYSTEM_STATUS.state === "operational";
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold sm:inline-flex ${
        ok ? "bg-green-tint text-green" : "bg-amber-tint text-amber"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full animate-soft-pulse ${ok ? "bg-green" : "bg-amber"}`} />
      {SYSTEM_STATUS.label}
    </span>
  );
}

export default function Header({ title, subtitle, onOpenMobileSidebar, onToggleDesktopSidebar, sidebarCollapsed }) {
  const now = useClock();
  const { datePart, timePart } = formatDateTime(now);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-3.5 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-navy-muted hover:bg-bg lg:hidden"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
        </button>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleDesktopSidebar}
            aria-label="Expand sidebar"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-navy-muted hover:bg-bg lg:flex"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold tracking-tight text-navy sm:text-[19px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 hidden truncate text-[12.5px] text-navy-soft sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden flex-col items-end leading-tight md:flex">
          <span className="font-mono text-[13px] font-semibold text-navy">{timePart}</span>
          <span className="text-[11px] font-medium text-navy-soft">{datePart}</span>
        </div>
        <SystemStatus />
        <NotificationsMenu />
      </div>
    </header>
  );
}
