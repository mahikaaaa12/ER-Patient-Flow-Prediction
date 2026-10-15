import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Cpu,
  Info,
  Loader2,
  MessageSquare,
  Percent,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import PageCard from "../components/PageCard";
import ModelBadge from "../components/ModelBadge";
import OperationalReport from "../components/OperationalReport";
import { erflowApi } from "../../services/api";
import { AI_MODEL_CONTEXT } from "../mockData";
import { useERContext } from "../../context/ERContext";

const SUGGESTED_QUESTIONS = [
  "What's the biggest issue right now?",
  "Why is workload high?",
  "What's the current waiting-time risk?",
  "Will crowding increase?",
  "What are the ESI level 1 triage guidelines?",
  "What should staff monitor next?",
];

const TOPIC_CATEGORIES = [
  { label: "Biggest Issue", query: "What's the biggest issue right now?", icon: AlertTriangle },
  { label: "Workload Rationale", query: "Why is workload high?", icon: Activity },
  { label: "Waiting Time Risk", query: "What's the current waiting-time risk?", icon: Clock },
  { label: "Crowding Outlook", query: "Will crowding increase?", icon: ShieldAlert },
  { label: "ESI Triage Protocol", query: "What are the ESI level 1 triage guidelines?", icon: BookOpen },
  { label: "Upcoming Monitoring", query: "What should staff monitor next?", icon: TrendingUp },
];

function UserMessageBubble({ text }) {
  return (
    <div className="flex items-start justify-end gap-2.5">
      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-navy px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-soft">
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white shadow-soft">
        <User className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </span>
    </div>
  );
}

function AssistantReportMessage({ message, operationalState }) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 w-full">
      <span
        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-soft ${
          message.isError
            ? "border border-red/30 bg-red-tint text-red"
            : "border border-blue/30 bg-blue-tint text-blue"
        }`}
      >
        <Bot className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 max-w-[100%] sm:max-w-[94%]">
        <OperationalReport message={message} operationalContext={operationalState} />
      </div>
    </div>
  );
}

function IntroState({ onAsk }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-tint text-blue shadow-soft border border-blue/20">
        <Bot className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-[18px] font-bold tracking-tight text-navy sm:text-[20px]">
          ER Operations Companion
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-navy-soft">
          Ask questions about patient demand, wait times, crowding risk, and clinical triage knowledge base protocols. Every answer is formatted as a structured operational report.
        </p>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="flex items-start gap-2.5 rounded-lg border border-border bg-bg p-3 text-left text-[12.5px] font-medium text-navy transition-all hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark shadow-soft"
          >
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const { operationalState, predictions } = useERContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    if (messages.length) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await erflowApi.sendChatMessage(trimmed, sessionId, operationalState || {});

      if (res.session_id) {
        setSessionId(res.session_id);
      }

      const assistantMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: res.response,
        intent: res.intent,
        confidence: res.confidence,
        data: res.data,
        timestamp: res.timestamp || new Date().toISOString(),
        isError: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.warn("Chatbot API connection error:", err.message);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: "The ERFlow assistant is temporarily unavailable. Please try again.",
        intent: "SERVICE_UNAVAILABLE",
        confidence: 0,
        data: null,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        section="ASSISTANT"
        title="Operations Companion"
        subtitle="Operational command reports, wait-time risk assessments, crowding outlooks, and clinical triage protocols."
        action={<ModelBadge model="RAG + Intent Router" />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main Chat & Report Panel */}
        <PageCard
          title="ER Operations Companion"
          subtitle="Query live department telemetry, multi-model predictions, and emergency protocols in standardized operational reports."
          icon={Bot}
          className="flex min-w-0 flex-col xl:col-span-2"
        >
          <div className="flex h-[560px] flex-col gap-5 overflow-y-auto pr-1 sm:pr-2">
            {hasMessages ? (
              <>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <UserMessageBubble key={m.id} text={m.text} />
                  ) : (
                    <AssistantReportMessage
                      key={m.id}
                      message={m}
                      operationalState={operationalState}
                    />
                  )
                )}

                {loading && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg/80 px-4 py-3 text-[12.5px] text-navy-muted shadow-soft">
                    <Loader2 className="h-4 w-4 animate-spin text-blue" />
                    <span>Evaluating current ED telemetry, ML engines & clinical protocols…</span>
                  </div>
                )}
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
              placeholder="Ask about biggest issue, workload, wait times, crowding, or triage guidelines…"
              disabled={loading}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13.5px] text-navy placeholder:text-navy-soft focus:border-blue focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue text-white transition-colors hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-50 shadow-soft"
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              )}
            </button>
          </form>

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-navy-soft">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            ERFlow provides operational decision support and does not provide medical diagnosis or clinical treatment recommendations.
          </p>
        </PageCard>

        {/* Sidebar Context & Suggested Actions */}
        <div className="flex flex-col gap-6">
          {/* CURRENT ER STATUS */}
          <PageCard title="CURRENT ER STATUS" icon={Activity}>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-md border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-blue mb-1">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Occupancy</p>
                <p className="mt-0.5 text-[15px] font-bold text-navy">{operationalState?.occupancy_percent ?? 78}%</p>
              </div>

              <div className="rounded-md border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-teal mb-1">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Waiting</p>
                <p className="mt-0.5 text-[15px] font-bold text-navy">{operationalState?.patients_waiting ?? 24} pts</p>
              </div>

              <div className="rounded-md border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-red mb-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Crowding</p>
                <p className="mt-0.5 text-[13px] font-bold text-red">{predictions?.crowding_risk?.crowding_level || "HIGH"}</p>
              </div>
            </div>
          </PageCard>

          {/* ASK ABOUT (Topic Categories) */}
          <PageCard title="ASK ABOUT" icon={Sparkles}>
            <div className="flex flex-col gap-2">
              {TOPIC_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => sendMessage(cat.query)}
                    disabled={loading}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3.5 py-2.5 text-left text-[13px] font-medium text-navy transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-blue" />
                      {cat.label}
                    </span>
                    <span className="text-[11px] font-semibold text-navy-soft">Query →</span>
                  </button>
                );
              })}
            </div>
          </PageCard>

          {/* SUGGESTED QUESTIONS */}
          <PageCard title="Suggested Questions" icon={MessageSquare}>
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="rounded-md border border-border bg-bg px-3.5 py-2.5 text-left text-[12.5px] font-medium text-navy-muted transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </PageCard>

          {/* DATA USED FOR THIS RESPONSE (Secondary Metadata) */}
          <div className="rounded-lg border border-border bg-surface shadow-soft">
            <button
              type="button"
              onClick={() => setContextOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              aria-expanded={contextOpen}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-tint text-blue">
                  <Cpu className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <h3 className="text-[14px] font-semibold text-navy">Data Used for This Response</h3>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-navy-soft transition-transform ${
                  contextOpen ? "rotate-180" : ""
                }`}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </button>

            {contextOpen && (
              <div className="flex flex-col gap-2 px-4 pb-4">
                {AI_MODEL_CONTEXT.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2"
                  >
                    <span className="text-[12.5px] font-medium text-navy-muted">{item.label}</span>
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-navy">
                      {item.model}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-[11.5px] leading-relaxed text-navy-soft">
                  The assistant explains and summarizes outputs from these underlying models and ChromaDB knowledge documents.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
