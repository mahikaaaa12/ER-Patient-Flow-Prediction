import { Brain, ClipboardList, Database, TrendingUp } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Database,
    title: "Collect",
    description: "Historical and current emergency department data is collected.",
  },
  {
    number: "02",
    icon: Brain,
    title: "Analyze",
    description: "Machine learning models identify patterns and current operational conditions.",
  },
  {
    number: "03",
    icon: TrendingUp,
    title: "Predict",
    description: "The system forecasts arrivals, waiting times and crowding risks.",
  },
  {
    number: "04",
    icon: ClipboardList,
    title: "Prepare",
    description: "Administrators receive predictions and operational insights before demand peaks.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-blue shadow-soft">
            How It Works
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            A Continuous Cycle From Data to Decision
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            Four steps run continuously in the background, turning raw ER data into
            operational guidance your team can act on before demand peaks.
          </p>
        </div>

        {/* ===== Desktop: connected horizontal timeline ===== */}
        <div className="relative mt-16 hidden lg:block">
          <div
            className="absolute left-0 right-0 top-[38px] h-px bg-border-strong"
            aria-hidden="true"
          />
          <div className="grid grid-cols-4 gap-6">
            {STEPS.map(({ number, icon: Icon, title, description }) => (
              <div key={number} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-[76px] w-[76px] items-center justify-center rounded-2xl border border-border bg-navy shadow-lift">
                  <Icon className="h-7 w-7 text-white" strokeWidth={2} aria-hidden="true" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface font-mono text-[11px] font-semibold text-blue shadow-soft">
                    {number}
                  </span>
                </div>
                <p className="mt-5 text-[16px] font-semibold text-navy">{title}</p>
                <p className="mt-2 max-w-[220px] text-[13px] leading-relaxed text-navy-muted">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Mobile / tablet: connected vertical timeline ===== */}
        <div className="mt-12 flex flex-col lg:hidden">
          {STEPS.map(({ number, icon: Icon, title, description }, index) => (
            <div key={number} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-navy shadow-lift">
                  <Icon className="h-5 w-5 text-white" strokeWidth={2} aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface font-mono text-[9px] font-semibold text-blue shadow-soft">
                    {number}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <span className="my-1 w-px flex-1 bg-border-strong" aria-hidden="true" />
                )}
              </div>
              <div className="pb-8">
                <p className="pt-3 text-[16px] font-semibold text-navy">{title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-navy-muted">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
