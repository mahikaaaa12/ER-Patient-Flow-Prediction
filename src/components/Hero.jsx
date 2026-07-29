import { ArrowRight, LayoutDashboard, PlayCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardPreview from "./DashboardPreview";

export default function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      {/* Ambient vital-line watermark, restrained and off to the side */}
      <svg
        className="pointer-events-none absolute -right-24 top-10 hidden h-64 w-[520px] opacity-[0.06] lg:block"
        viewBox="0 0 520 120"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M0 60 H140 L162 20 L188 100 L212 40 L232 60 H520"
          stroke="var(--color-navy)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-10">
          {/* Left column */}
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-blue shadow-soft">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              AI-Powered Emergency Department Intelligence
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-[3.25rem]">
              Predict Patient Demand Before the ER Gets Overwhelmed.
            </h1>

            <p className="mt-5 text-[17px] leading-relaxed text-navy-muted sm:text-lg">
              Forecast patient arrivals, estimate waiting times, identify crowding risks,
              and detect unexpected patient surges before demand reaches critical levels.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#platform"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue px-5 py-3 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-blue-dark"
              >
                Explore Platform
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-[15px] font-semibold text-navy transition-colors hover:border-border-strong hover:bg-bg"
              >
                <PlayCircle className="h-4 w-4" strokeWidth={2.25} />
                See How It Works
              </a>
            </div>

            <div className="mt-7 flex items-center gap-3">
              <div className="vital-rule w-8 sm:w-10" />
              <p className="text-[13px] font-medium text-navy-soft">
                Powered by Machine Learning, Deep Learning and Predictive Analytics
              </p>
            </div>
          </div>

          {/* Right column — dashboard preview is the visual focus */}
          <div className="flex flex-col items-center gap-4 lg:items-end">
            <DashboardPreview />
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-semibold text-navy shadow-soft transition-colors hover:border-border-strong hover:bg-bg"
            >
              <LayoutDashboard className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              View Dashboard
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
