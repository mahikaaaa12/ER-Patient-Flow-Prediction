import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  Cpu,
  Info,
  Send,
  Sparkles,
  Timer,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import PageCard from "../components/PageCard";
import {
  AI_SUGGESTED_QUESTIONS,
  AI_CANNED_RESPONSES,
  AI_MODEL_CONTEXT,
} from "../mockData";

// Icon lookup so mock data can reference icons by name (keeps mockData.js
// framework-agnostic / JSON-serializable, which matters once real API
// responses replace the canned ones).
const INSIGHT_ICONS = { Users, Clock, AlertTriangle, Timer, TrendingUp, Activity, Cpu };

// Tailwind can't resolve interpolated class names like `bg-${tone}-tint` at
// build time, so tones are mapped to static class strings here.
const INSIGHT_TONE_CLASS = {
  navy: "bg-navy/5 text-navy",
  blue: "bg-blue-tint text-blue",
  teal: "bg-teal-tint text-teal",
  green: "bg-green-tint text-green",
  amber: "bg-amber-tint text-amber",
  red: "bg-red-tint text-red",
};

const FALLBACK_RESPONSE = {
  text:
    "This is a front-end demo, so responses here are static examples rather than a live AI model. Try one of the suggested questions above to see a sample answer with supporting data.",
  insights: null,
};

// ---------------------------------------------------------------------
// Mock response resolver — the ONLY place a real integration needs to
// change. Swap this out for an async call to the AI Operations backend
// (e.g. `await fetch("/api/ai-assistant/query", { ... })`) once it's
// available; everything downstream already expects `{ text, insights }`.
// ---------------------------------------------------------------------
function getAssistantReply(question) {
  return AI_CANNED_RESPONSES[question] || FALLBACK_RESPONSE;
}

function InsightCards({ insights }) {
  if (!insights?.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {insights.map((item) => {
        const Icon = INSIGHT_ICONS[item.icon] || Activity;
        return (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-bg px-3 py-2.5"
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-md ${
                INSIGHT_TONE_CLASS[item.tone] || INSIGHT_TONE_CLASS.navy
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <p className="mt-1.5 font-mono text-[14px] font-semibold text-navy">{item.value}</p>
            <p className="truncate text-[11px] font-medium text-navy-soft">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function Bubble({ role, text, insights }) {
  const isUser = role === "user";
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-navy text-white" : "bg-blue-tint text-blue"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Bot className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        )}
      </span>
      <div className={`min-w-0 max-w-[88%] sm:max-w-[78%] ${isUser ? "flex flex-col items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-navy text-white"
              : "rounded-tl-sm border border-border bg-surface text-navy"
          }`}
        >
          {text}
        </div>
        {!isUser && <InsightCards insights={insights} />}
      </div>
    </div>
  );
}

// Empty-state hero shown before the first message is sent.
function IntroState({ onAsk }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-tint text-blue">
        <Bot className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-[18px] font-semibold tracking-tight text-navy sm:text-[20px]">
          How can I help you understand today's ER operations?
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-navy-soft">
          Ask about patient demand, waiting times, crowding risk, or try one of the questions below.
        </p>
      </div>
      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AI_SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="rounded-xl border border-border bg-bg px-3.5 py-3 text-left text-[13px] font-medium text-navy-muted transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [contextOpen, setContextOpen] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    if (messages.length) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    const reply = getAssistantReply(trimmed);
    const assistantMsg = {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: reply.text,
      insights: reply.insights,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <PageCard
          title="ER Operations Assistant"
          subtitle="Ask questions about patient demand, waiting times, crowding risks, and emergency department operations."
          icon={Bot}
          className="flex min-w-0 flex-col xl:col-span-2"
        >
          <div className="flex h-[480px] flex-col gap-5 overflow-y-auto pr-1">
            {hasMessages ? (
              <>
                {messages.map((m) => (
                  <Bubble key={m.id} role={m.role} text={m.text} insights={m.insights} />
                ))}
                <div ref={endRef} />
              </>
            ) : (
              <IntroState onAsk={sendMessage} />
            )}
          </div>

          <form
            className="mt-4 flex items-center gap-2 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about forecasts, crowding, waiting times…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13.5px] text-navy placeholder:text-navy-soft focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue text-white transition-colors hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
            </button>
          </form>

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-navy-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            ERFlow provides operational decision support and does not provide medical diagnosis or
            clinical treatment recommendations.
          </p>
        </PageCard>

        <div className="flex flex-col gap-6">
          <PageCard title="Suggested Questions" icon={Sparkles}>
            <div className="flex flex-col gap-2.5">
              {AI_SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-xl border border-border bg-bg px-3.5 py-3 text-left text-[13px] font-medium text-navy-muted transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-navy-soft">
              This assistant is a front-end preview only. Answers shown here are pre-written
              examples — no live model or backend is connected yet.
            </p>
          </PageCard>

          {/* Model context panel — expandable, collapses naturally on mobile
              since it's just a toggled section rather than a fixed side rail. */}
          <div className="rounded-2xl border border-border bg-surface shadow-soft">
            <button
              type="button"
              onClick={() => setContextOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
              aria-expanded={contextOpen}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-tint text-blue">
                  <Cpu className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold text-navy">Data Used for This Response</h3>
                  <p className="mt-0.5 text-[13px] text-navy-soft">
                    Models feeding the assistant's explanations
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`mt-1 h-4.5 w-4.5 shrink-0 text-navy-soft transition-transform ${
                  contextOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </button>

            {contextOpen && (
              <div className="flex flex-col gap-2 px-5 pb-5 sm:px-6 sm:pb-6">
                {AI_MODEL_CONTEXT.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5"
                  >
                    <span className="text-[13px] font-medium text-navy-muted">{item.label}</span>
                    <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[12px] font-semibold text-navy">
                      {item.model}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-[12px] leading-relaxed text-navy-soft">
                  The assistant explains and summarizes outputs from these underlying models — it
                  does not generate predictions itself.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
