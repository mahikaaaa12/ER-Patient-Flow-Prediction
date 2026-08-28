import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  Database,
  LayoutDashboard,
  TrendingUp,
  Waves,
} from "lucide-react";

const GROUPS = [
  {
    key: "supervised",
    label: "Supervised Learning",
    accent: "blue",
    nodes: [
      { icon: Clock, title: "Waiting Time Prediction" },
      { icon: AlertTriangle, title: "Crowding Risk Prediction" },
    ],
  },
  {
    key: "unsupervised",
    label: "Unsupervised Learning",
    accent: "teal",
    nodes: [
      { icon: Activity, title: "Patient Flow Pattern Discovery" },
      { icon: Waves, title: "Patient Surge Detection" },
    ],
  },
  {
    key: "deep",
    label: "Deep Learning",
    accent: "green",
    nodes: [{ icon: TrendingUp, title: "Patient Arrival Forecasting" }],
  },
];

const ACCENT_CLASSES = {
  blue: { text: "text-blue", bg: "bg-blue-tint", dot: "bg-blue" },
  teal: { text: "text-teal", bg: "bg-teal-tint", dot: "bg-teal" },
  green: { text: "text-green", bg: "bg-green-tint", dot: "bg-green" },
};

function GroupColumn({ group }) {
  const accent = ACCENT_CLASSES[group.accent];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
        <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-soft">
          {group.label}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {group.nodes.map(({ icon: Icon, title }) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
              <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="text-[14px] font-semibold leading-snug text-navy">{title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ModelArchitecture() {
  return (
    <section id="model-architecture" className="relative border-t border-border bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-blue shadow-soft">
            AI Architecture
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            How the AI Models Connect
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            A single stream of ER data feeds three types of models, each answering a
            different operational question, and every result is unified by the AI
            Operations Assistant before reaching the dashboard.
          </p>
        </div>

        {/* ===== Desktop / tablet architecture diagram ===== */}
        <div className="mt-14 hidden lg:block">
          <div className="flex items-stretch gap-3 xl:gap-4">
            {/* ER Data source */}
            <div className="flex w-36 shrink-0 flex-col items-center justify-center gap-3 self-center rounded-2xl border border-border bg-navy p-5 text-center shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                <Database className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[14px] font-semibold text-white">Hospital ER Data</p>
              <p className="text-[11px] leading-snug text-white/60">
                Arrivals, wait times, staffing &amp; occupancy
              </p>
            </div>

            <div className="flex shrink-0 items-center text-navy-soft" aria-hidden="true">
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </div>

            {/* Three model-type branches */}
            <div className="grid flex-1 grid-cols-3 gap-3 xl:gap-4">
              {GROUPS.map((group) => (
                <GroupColumn key={group.key} group={group} />
              ))}
            </div>

            <div className="flex shrink-0 items-center text-navy-soft" aria-hidden="true">
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </div>

            {/* Convergence: AI Operations Assistant */}
            <div className="flex w-40 shrink-0 flex-col items-center justify-center gap-3 self-center rounded-2xl border border-amber/30 bg-amber-tint p-5 text-center shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber text-white">
                <Bot className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[14px] font-semibold text-navy">AI Operations Assistant</p>
              <p className="text-[11px] leading-snug text-navy-muted">
                Unifies every model output into one summary
              </p>
            </div>

            <div className="flex shrink-0 items-center text-navy-soft" aria-hidden="true">
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </div>

            {/* Dashboard target */}
            <div className="flex w-40 shrink-0 flex-col items-center justify-center gap-3 self-center rounded-2xl border border-blue/30 bg-blue-tint p-5 text-center shadow-lift">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue text-white">
                <LayoutDashboard className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[14px] font-semibold text-navy">ER Operations Dashboard</p>
              <p className="text-[11px] leading-snug text-navy-muted">
                Every prediction, unified in one view
              </p>
            </div>
          </div>
        </div>

        {/* ===== Mobile: simple vertical flow ===== */}
        <div className="mt-12 flex flex-col items-center lg:hidden">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-navy p-5 text-center shadow-lift">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
              <Database className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-white">Hospital ER Data</p>
            <p className="text-[12px] leading-snug text-white/60">
              Arrivals, wait times, staffing &amp; occupancy
            </p>
          </div>

          <div className="my-1 h-8 w-px bg-border-strong" aria-hidden="true" />

          <div className="flex w-full max-w-sm flex-col gap-6">
            {GROUPS.map((group) => {
              const accent = ACCENT_CLASSES[group.accent];
              return (
                <div key={group.key} className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-navy-soft">
                      {group.label}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {group.nodes.map(({ icon: Icon, title }) => (
                      <div
                        key={title}
                        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
                          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                        </span>
                        <p className="text-[14px] font-semibold leading-snug text-navy">{title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-1 h-8 w-px bg-border-strong" aria-hidden="true" />

          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-amber/30 bg-amber-tint p-5 text-center shadow-lift">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber text-white">
              <Bot className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-navy">AI Operations Assistant</p>
            <p className="text-[12px] leading-snug text-navy-muted">
              Unifies every model output into one summary
            </p>
          </div>

          <div className="my-1 h-8 w-px bg-border-strong" aria-hidden="true" />

          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-blue/30 bg-blue-tint p-5 text-center shadow-lift">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue text-white">
              <LayoutDashboard className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold text-navy">ER Operations Dashboard</p>
            <p className="text-[12px] leading-snug text-navy-muted">
              Every prediction, unified in one view
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
