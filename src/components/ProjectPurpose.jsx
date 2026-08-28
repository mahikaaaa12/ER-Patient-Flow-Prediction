import { CheckCircle2, Compass, MinusCircle } from "lucide-react";

const IN_SCOPE = [
  "Predicts emergency department patient demand ahead of time",
  "Forecasts operational conditions such as crowding and patient flow",
  "Supports staffing, bed, and resource planning decisions",
  "Surfaces trends and risk signals for hospital administrators",
];

const OUT_OF_SCOPE = [
  "Does not provide medical diagnoses",
  "Does not make clinical treatment decisions",
  "Does not replace clinical judgment or hospital protocols",
  "Does not act on or store individual patient records",
];

export default function ProjectPurpose() {
  return (
    <section id="purpose" className="relative border-t border-border bg-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-navy-muted shadow-soft">
            <Compass className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            Project Purpose
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            An Operational Decision-Support Platform
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            ERFlow is designed to predict emergency department demand and operational
            conditions, helping teams plan ahead with clearer visibility into what&apos;s coming.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-soft sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-tint text-green">
                <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[15px] font-semibold text-navy">What ERFlow Does</p>
            </div>
            <ul className="flex flex-col gap-3">
              {IN_SCOPE.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
                  <span className="text-[14.5px] leading-relaxed text-navy-muted">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-soft sm:p-7">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-navy-muted">
                <MinusCircle className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[15px] font-semibold text-navy">What ERFlow Doesn&apos;t Do</p>
            </div>
            <ul className="flex flex-col gap-3">
              {OUT_OF_SCOPE.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-soft" />
                  <span className="text-[14.5px] leading-relaxed text-navy-muted">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-relaxed text-navy-soft">
          It does not provide medical diagnoses or make clinical treatment decisions &mdash;
          those remain the responsibility of qualified clinical staff.
        </p>
      </div>
    </section>
  );
}
