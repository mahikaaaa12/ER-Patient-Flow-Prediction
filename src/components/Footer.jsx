import { Activity } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Platform", href: "#platform" },
  { label: "AI Models", href: "#ai-models" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Technology", href: "#technology" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <a href="#home" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue text-white">
                <Activity className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-navy">ERFlow</span>
            </a>
            <p className="mt-3 text-[13.5px] leading-relaxed text-navy-muted">
              AI-Based Emergency Room Patient Flow Prediction
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-soft">
              Navigation
            </p>
            <ul className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:gap-8">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[14.5px] font-medium text-navy-muted transition-colors hover:text-blue"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="vital-rule mt-10" />

        <div className="mt-6 flex flex-col-reverse items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-[12.5px] text-navy-soft">
            &copy; {year} ERFlow. Developed as an academic AI/ML project.
          </p>
          <p className="text-[12.5px] text-navy-soft">
            Operational decision-support &mdash; not a clinical diagnostic tool.
          </p>
        </div>
      </div>
    </footer>
  );
}
