import { useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileText,
  Info,
  Percent,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { parseOperationalReport } from "../utils/reportParser";

const ICON_MAP = {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Percent,
  ShieldAlert,
  Target,
  TrendingUp,
  Users,
};

const TONE_BORDER = {
  red: "border-red/30",
  amber: "border-amber/40",
  teal: "border-teal/30",
  green: "border-green/30",
  blue: "border-blue/30",
  purple: "border-purple/30",
  navy: "border-border",
};

const TONE_BG = {
  red: "bg-red-tint/70",
  amber: "bg-amber-tint/80",
  teal: "bg-teal-tint/70",
  green: "bg-green-tint/70",
  blue: "bg-blue-tint/70",
  purple: "bg-purple-tint/70",
  navy: "bg-bg",
};

const TONE_TEXT = {
  red: "text-red-dark",
  amber: "text-amber-dark",
  teal: "text-teal",
  green: "text-green",
  blue: "text-blue-dark",
  purple: "text-purple",
  navy: "text-navy",
};

const TONE_BADGE = {
  red: "border border-red/30 bg-red-tint text-red font-semibold",
  amber: "border border-amber/40 bg-amber-tint text-amber-dark font-semibold",
  teal: "border border-teal/30 bg-teal-tint text-teal font-semibold",
  green: "border border-green/30 bg-green-tint text-green font-semibold",
  blue: "border border-blue/30 bg-blue-tint text-blue-dark font-semibold",
  purple: "border border-purple/30 bg-purple-tint text-purple font-semibold",
  navy: "border border-border bg-bg text-navy-muted font-semibold",
};

const PRIORITY_BADGE = {
  Critical: "border border-red/40 bg-red-tint text-red font-bold",
  High: "border border-amber/50 bg-amber-tint text-amber-dark font-semibold",
  Moderate: "border border-blue/40 bg-blue-tint text-blue-dark font-semibold",
  Low: "border border-border bg-bg text-navy-muted font-medium",
};

export default function OperationalReport({ message, operationalContext }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (!message) return null;

  const report = parseOperationalReport({
    text: message.text,
    intent: message.intent,
    confidence: message.confidence,
    data: message.data,
    timestamp: message.timestamp,
    isError: message.isError,
    operationalContext,
  });

  const {
    category,
    title,
    tone = "blue",
    statusBadge,
    timestamp,
    summary,
    alertBanner,
    metrics = [],
    findings = [],
    actions = [],
    forecast,
    knowledge,
    markdownBody,
    limitations,
  } = report;

  const hasMetrics = Array.isArray(metrics) && metrics.length > 0;
  const hasFindings = Array.isArray(findings) && findings.length > 0;
  const hasActions = Array.isArray(actions) && actions.length > 0;

  return (
    <article className="w-full rounded-xl border border-border bg-surface shadow-soft transition-all overflow-hidden text-navy">
      {/* 1. REPORT HEADER */}
      <header className="border-b border-border bg-bg/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded bg-surface px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-navy-soft border border-border shadow-soft">
              <span className={`h-1.5 w-1.5 rounded-full ${tone === "red" ? "bg-red" : tone === "amber" ? "bg-amber" : tone === "green" ? "bg-green" : "bg-blue"}`} />
              {category}
            </span>
            {timestamp && (
              <span className="hidden sm:inline-block text-[11px] font-medium text-navy-soft">
                • {timestamp}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {statusBadge && (
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${TONE_BADGE[statusBadge.tone || tone]}`}>
                {statusBadge.label}
              </span>
            )}
            <span className="rounded bg-surface px-2 py-0.5 text-[10.5px] font-mono text-navy-soft border border-border">
              REPORT
            </span>
          </div>
        </div>

        <h3 className="mt-2 text-[15px] font-bold tracking-tight text-navy sm:text-[16px]">
          {title}
        </h3>
      </header>

      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* CRITICAL ESCALATION BANNER (e.g. ESI 1) */}
        {alertBanner && (
          <div className={`rounded-lg border px-3.5 py-3 ${TONE_BORDER[alertBanner.tone || "red"]} ${TONE_BG[alertBanner.tone || "red"]}`}>
            <div className="flex items-start gap-2.5">
              <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red" />
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-red">
                  {alertBanner.title}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-navy">
                  {alertBanner.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. EXECUTIVE SUMMARY */}
        {summary && (
          <section className={`rounded-lg border-l-4 border-y border-r px-4 py-3 ${tone === "red" ? "border-l-red" : tone === "amber" ? "border-l-amber" : tone === "green" ? "border-l-green" : "border-l-blue"} ${TONE_BORDER[tone]} ${TONE_BG[tone]}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-soft">
              <Info className="h-3.5 w-3.5 text-navy-muted" />
              <span>Executive Summary</span>
            </div>
            {summary.headline && (
              <h4 className={`mt-1 text-[13.5px] font-bold ${TONE_TEXT[tone]}`}>
                {summary.headline}
              </h4>
            )}
            {summary.text && (
              <p className="mt-1 text-[13px] leading-relaxed text-navy-muted">
                {summary.text}
              </p>
            )}
          </section>
        )}

        {/* 3. CURRENT OPERATIONAL METRICS GRID */}
        {hasMetrics && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
                Operational Telemetry & Metrics
              </h4>
              <span className="text-[10.5px] font-medium text-navy-soft">Verified Telemetry</span>
            </div>

            <div className={`grid grid-cols-2 gap-2.5 ${metrics.length >= 4 ? "sm:grid-cols-4" : metrics.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {metrics.map((m, idx) => {
                const IconComponent = ICON_MAP[m.icon] || Activity;
                const mTone = m.tone || "navy";
                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-lg border border-border bg-bg/60 p-2.5 sm:p-3 transition-colors hover:bg-bg"
                  >
                    <div className="flex items-center justify-between gap-1 text-navy-soft">
                      <span className="truncate text-[10.5px] font-semibold uppercase tracking-wider">
                        {m.label}
                      </span>
                      <IconComponent className={`h-3.5 w-3.5 shrink-0 ${TONE_TEXT[mTone]}`} />
                    </div>
                    <div className="mt-1.5">
                      <p className={`font-mono text-[18px] sm:text-[20px] font-bold tracking-tight ${TONE_TEXT[mTone]}`}>
                        {m.value}
                        {m.unit && (
                          <span className="ml-1 text-[11px] font-medium text-navy-soft">
                            {m.unit}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. KEY FINDINGS */}
        {hasFindings && (
          <section className="rounded-lg border border-border bg-surface p-3.5">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
              <Sparkles className="h-3.5 w-3.5 text-blue" />
              <span>Key Operational Findings</span>
            </h4>
            <ul className="flex flex-col gap-1.5">
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-navy-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                  <div className="flex-1">
                    <MarkdownRenderer content={finding} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. RECOMMENDED OPERATIONAL ACTIONS */}
        {hasActions && (
          <section className="rounded-lg border border-border bg-surface p-3.5">
            <h4 className="mb-2.5 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                <span>Recommended Operational Actions</span>
              </span>
              <span className="text-[10.5px] font-normal text-navy-soft">Prioritized Decision Support</span>
            </h4>

            <div className="flex flex-col gap-2.5">
              {actions.map((act, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-bg/40 p-3 transition-colors hover:border-border-strong hover:bg-bg/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <h5 className="text-[13px] font-bold text-navy">
                        {act.title}
                      </h5>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {act.priority && (
                        <span className={`rounded px-1.5 py-0.5 text-[10.5px] ${PRIORITY_BADGE[act.priority] || PRIORITY_BADGE.Moderate}`}>
                          {act.priority} Priority
                        </span>
                      )}
                      {act.urgency && (
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10.5px] font-mono text-navy-soft">
                          <Clock className="h-3 w-3 text-navy-soft" />
                          {act.urgency}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-navy-muted pl-7">
                    {act.description}
                  </p>

                  {(act.why || act.role) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2 pl-7 text-[11.5px] text-navy-soft">
                      {act.why && (
                        <span className="flex items-center gap-1 text-navy-muted">
                          <span className="font-semibold text-blue">Rationale:</span> {act.why}
                        </span>
                      )}
                      {act.role && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded bg-bg px-2 py-0.5 text-[11px] font-medium text-navy-muted border border-border">
                          Target: {act.role}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. FORECAST OR RISK OUTLOOK */}
        {forecast && (
          <section className="rounded-lg border border-blue/20 bg-blue-tint/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-blue-dark">
                <TrendingUp className="h-3.5 w-3.5 text-blue" />
                <span>Forecast & Risk Outlook</span>
              </h4>
              <span className="rounded bg-surface px-2 py-0.5 text-[10.5px] font-mono text-navy-soft border border-border">
                {forecast.horizon || "Upcoming Window"}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border/80 bg-surface/90 p-2.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">
                  Projected Trajectory
                </span>
                <p className="mt-0.5 text-[13px] font-bold text-navy">
                  {forecast.trajectory}
                </p>
              </div>

              <div className="rounded-md border border-border/80 bg-surface/90 p-2.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">
                  Source ML Engine
                </span>
                <p className="mt-0.5 font-mono text-[12px] font-semibold text-blue-dark truncate">
                  {forecast.model}
                </p>
              </div>
            </div>

            {forecast.indicator && (
              <p className="mt-2 text-[11.5px] text-navy-soft italic">
                Indicator: {forecast.indicator}
              </p>
            )}
          </section>
        )}

        {/* 7. PROTOCOL / KNOWLEDGE BASE GUIDANCE MARKDOWN BODY */}
        {markdownBody && (
          <section className="rounded-lg border border-border bg-surface p-3.5">
            <h4 className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-navy-soft">
              <BookOpen className="h-3.5 w-3.5 text-blue" />
              <span>Clinical Guidance & Protocol Details</span>
            </h4>
            <div className="text-[13px] leading-relaxed text-navy-muted">
              <MarkdownRenderer content={markdownBody} />
            </div>
          </section>
        )}

        {/* 8. KNOWLEDGE SOURCES PILLS (RAG) */}
        {knowledge?.sources && knowledge.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg/50 px-3 py-2 text-[11.5px] text-navy-soft">
            <span className="flex items-center gap-1 font-semibold text-navy">
              <FileText className="h-3.5 w-3.5 text-blue" />
              Knowledge Citations:
            </span>
            {knowledge.sources.map((src, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5 font-sans font-medium text-navy text-[11px]"
              >
                {src}
              </span>
            ))}
            {knowledge.confidenceScore && (
              <span className="ml-auto font-mono text-[10.5px] text-navy-soft">
                Retrieval Score: {knowledge.confidenceScore}%
              </span>
            )}
          </div>
        )}

        {/* 9. DATA SOURCES & OPERATIONAL LIMITATIONS (EXPANDABLE) */}
        <footer className="border-t border-border pt-2 text-[11.5px]">
          <button
            type="button"
            onClick={() => setSourcesOpen((prev) => !prev)}
            className="flex w-full items-center justify-between py-1 text-left text-navy-soft hover:text-navy transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="h-3.5 w-3.5 text-navy-soft" />
              <span>Data Sources, Engine Verification & Limitations</span>
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${sourcesOpen ? "rotate-180" : ""}`}
            />
          </button>

          {sourcesOpen && (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-bg/60 p-3 text-navy-muted animate-in fade-in">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-navy">Contributing Engines:</span>
                {(limitations?.models || ["Operational Telemetry Pipeline"]).map((modelName, i) => (
                  <span
                    key={i}
                    className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-[10.5px] font-medium text-navy"
                  >
                    {modelName}
                  </span>
                ))}
              </div>

              {limitations?.note && (
                <p className="text-[11.5px] text-navy-soft leading-relaxed">
                  {limitations.note}
                </p>
              )}

              <p className="border-t border-border/60 pt-1.5 text-[11px] text-navy-soft italic">
                Notice: ERFlow provides operational decision support and resource allocation guidance only. It does not provide medical diagnosis or clinical treatment recommendations.
              </p>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
}
