import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export default function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-border bg-navy">
      {/* Ambient vital-line watermark, echoing the hero motif */}
      <svg
        className="pointer-events-none absolute -left-24 bottom-0 hidden h-56 w-[520px] opacity-[0.08] lg:block"
        viewBox="0 0 520 120"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M0 60 H140 L162 20 L188 100 L212 40 L232 60 H520"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
            Prepare for Patient Demand Before It Becomes a Crisis.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-white/70 sm:text-lg">
            Turn historical emergency department data into forecasts that help teams
            understand upcoming demand, crowding risks and patient flow.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-[15px] font-semibold text-navy shadow-soft transition-colors hover:bg-white/90 sm:w-auto"
            >
              <LayoutDashboard className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              Open ER Dashboard
            </Link>
            <a
              href="#technology"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-transparent px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Explore the Technology
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
