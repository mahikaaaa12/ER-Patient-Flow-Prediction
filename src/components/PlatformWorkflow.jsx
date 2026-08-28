import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  Database,
  Gauge,
  LineChart,
  Radar,
} from "lucide-react";

const STEPS = [
  {
    icon: Database,
    title: "Hospital Data",
    description: "Historical and real-time ED records, admissions, and operational metrics.",
  },
  {
    icon: BrainCircuit,
    title: "AI Analysis",
    description: "Machine learning and deep learning models process demand signals.",
  },
  {
    icon: LineChart,
    title: "Patient Demand Forecast",
    description: "Expected arrivals are projected across multiple time horizons.",
  },
  {
    icon: Radar,
    title: "Crowding Prediction",
    description: "Forecasts are translated into department-level crowding risk.",
  },
  {
    icon: Gauge,
    title: "Operational Insights",
    description: "Clear, actionable guidance for staffing and resource decisions.",
  },
];

export default function PlatformWorkflow() {
  return (
    <section id="platform" className="relative border-t border-border bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-blue shadow-soft">
            The Platform
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            From Historical Data to Operational Foresight
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            ERFlow turns historical and current emergency department data into a
            continuous pipeline of predictions your team can act on.
          </p>
        </div>

        <div className="mt-14 flex flex-col lg:flex-row lg:items-stretch">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <div key={title} className="flex flex-col lg:flex-1 lg:flex-row lg:items-stretch">
              <div className="flex flex-1 flex-col items-center gap-3 rounded-xl border border-border bg-surface p-5 text-center shadow-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-tint text-blue">
                  <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <p className="text-[15px] font-semibold text-navy">{title}</p>
                <p className="text-[13px] leading-relaxed text-navy-muted">{description}</p>
              </div>

              {index < STEPS.length - 1 && (
                <>
                  <span
                    className="my-2 flex shrink-0 justify-center text-navy-soft lg:hidden"
                    aria-hidden="true"
                  >
                    <ChevronDown className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span
                    className="mx-2 hidden shrink-0 self-center text-navy-soft lg:flex"
                    aria-hidden="true"
                  >
                    <ArrowRight className="h-5 w-5" strokeWidth={2} />
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
