import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Clock,
  TrendingUp,
  Waves,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: TrendingUp,
    title: "Patient Arrival Forecasting",
    description: "Forecast expected arrivals for the next 1, 3, 6 and 24 hours.",
    badge: "LSTM",
  },
  {
    icon: Clock,
    title: "Waiting Time Prediction",
    description: "Estimate expected patient waiting times based on current ER conditions.",
    badge: "XGBoost Regression",
  },
  {
    icon: AlertTriangle,
    title: "Crowding Risk Prediction",
    description: "Predict Low, Moderate, High or Critical crowding levels.",
    badge: "XGBoost Classification",
  },
  {
    icon: Activity,
    title: "Patient Flow Pattern Discovery",
    description: "Identify recurring demand patterns across different operational conditions.",
    badge: "K-Means Clustering",
  },
  {
    icon: Waves,
    title: "Patient Surge Detection",
    description: "Detect unusual increases in patient arrivals.",
    badge: "Isolation Forest",
  },
  {
    icon: Bot,
    title: "AI Operations Assistant",
    description: "Convert model predictions into clear operational summaries.",
    badge: "LLM Integration",
  },
];

export default function CoreCapabilities() {
  return (
    <section id="ai-models" className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-teal">
            Core Capabilities
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            A Complete Predictive Toolkit for the ED
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            Six purpose-built models cover forecasting, risk, pattern discovery, and
            operational summaries, each tuned for emergency department data.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, description, badge }) => (
            <div
              key={title}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-bg p-5 shadow-soft transition-shadow hover:shadow-lift"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-tint text-blue">
                <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[15px] font-semibold text-navy">{title}</p>
              <p className="flex-1 text-[13px] leading-relaxed text-navy-muted">{description}</p>
              <span className="inline-flex w-fit items-center rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-navy-soft">
                {badge}
              </span>
              <button
                type="button"
                className="mt-1 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-blue transition-colors hover:text-blue-dark"
              >
                Learn More
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
