import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
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
import PageCard from "../components/PageCard";
import MLContextCard from "../components/MLContextCard";
import { erflowApi } from "../../services/api";
import { AI_MODEL_CONTEXT } from "../mockData";
import { useMode } from "../../context/ModeContext";

// Prediction Intents requiring structured ML display
const ML_INTENTS = [
  "PATIENT_VOLUME",
  "WAITING_TIME",
  "CROWDING",
  "HIGH_DEMAND_PERIOD",
  "FLOW_PATTERN",
  "GENERAL_STATUS",
];

const SUGGESTED_QUESTIONS = [
  "How busy is the ER right now?",
  "What is the expected patient volume?",
  "Will crowding increase?",
  "What is the current waiting-time risk?",
  "What patterns are you seeing?",
];

const TOPIC_CATEGORIES = [
  { label: "Patient Flow", query: "How busy is the ER right now?", icon: Activity },
  { label: "Waiting Times", query: "What is the current waiting-time risk?", icon: Clock },
  { label: "Crowding", query: "Will crowding increase?", icon: ShieldAlert },
  { label: "Demand Forecasts", query: "What is the expected patient volume?", icon: TrendingUp },
  { label: "Flow Patterns", query: "What patterns are you seeing?", icon: Sparkles },
];

function MLPredictionCard({ data, intent, confidence, timestamp }) {
  const { isRealMode } = useMode();
  if (!data || typeof data !== "object") return null;

  // Validation failure / Clarification state
  if (data.validation_failed) {
    return (
      <div className="mt-3 rounded-xl border border-amber/30 bg-amber-tint/60 px-3.5 py-2.5 text-[12px] text-amber-dark">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5 text-amber" />
          <span>Clarification Required for Model Input</span>
        </div>
        <p className="mt-1 text-[11.5px] text-navy-soft">
          Please specify requested date, time, or triage acuity parameters so the model can generate a precise prediction.
        </p>
      </div>
    );
  }

  // Extract primary prediction value
  const predictionVal =
    data.predicted_volume !== undefined ? `${data.predicted_volume} arrivals` :
    data.estimated_wait_minutes !== undefined ? `${data.estimated_wait_minutes} mins` :
    data.crowding_level ||
    data.status ||
    data.pattern_name ||
    (data.cluster_id !== undefined ? `Cluster #${data.cluster_id}` : null) ||
    data.prediction ||
    "N/A";

  const modelName = data.adapter || data.model_name || "Real ML Model Adapter";

  // Build WHAT THE MODEL SEES strictly from available inputs
  const inputsSees = [];
  if (data.patients_waiting !== undefined) inputsSees.push(`${data.patients_waiting} patients waiting`);
  if (data.arrival_rate !== undefined) inputsSees.push(`${data.arrival_rate} arrivals/hr`);
  if (data.occupancy_percent !== undefined) inputsSees.push(`${data.occupancy_percent}% occupancy`);
  if (inputsSees.length === 0) {
    if (isRealMode) {
      inputsSees.push("Live ER Operational State");
    } else {
      inputsSees.push("24 patients waiting (Demo)", "28 arrivals/hr (Demo)", "78% occupancy (Demo)");
    }
  }

  return (
    <div className="mt-3">
      <MLContextCard
        sees={inputsSees}
        predicts={String(predictionVal)}
        when={data.expected_window || data.time_window || "Next 3 Hours"}
        source={modelName}
      />
    </div>
  );
}

function PredictionUnavailableBadge({ intent }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-[12px] text-navy-soft">
      <div className="flex items-center gap-1.5 font-semibold text-navy">
        <AlertTriangle className="h-3.5 w-3.5 text-amber" />
        <span>Prediction Currently Unavailable</span>
      </div>
      <p className="mt-1 text-[11.5px]">
        The required ML model for <code className="font-mono font-semibold text-navy">{intent}</code> could not be executed or is currently offline.
      </p>
    </div>
  );
}

function Bubble({ role, text, intent, confidence, data, timestamp, isError }) {
  const isUser = role === "user";
  const isMLIntent = ML_INTENTS.includes(intent);
  const hasMLData = data && typeof data === "object" && !data.validation_failed;

  return (
    <div className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-navy text-white" : isError ? "bg-red-tint text-red" : "bg-blue-tint text-blue"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Bot className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        )}
      </span>
      <div className={`min-w-0 max-w-[88%] sm:max-w-[78%] ${isUser ? "flex flex-col items-end" : ""}`}>
        {/* Natural Language Primary Message */}
        <div
          className={`rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-navy text-white"
              : isError
              ? "rounded-tl-sm border border-red/30 bg-red-tint text-red"
              : "rounded-tl-sm border border-border bg-surface text-navy"
          }`}
        >
          {text}
        </div>

        {/* Clear Distinction: General Chatbot Response vs ML-Backed Prediction Result */}
        {!isUser && !isError && (
          <>
            {!isMLIntent ? (
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-navy-soft">
                <span className="rounded-md border border-border bg-bg px-2 py-0.5 font-mono font-semibold">
                  💬 Operational Assistant ({intent || "GENERAL"})
                </span>
              </div>
            ) : (
              <>
                {hasMLData ? (
                  <MLPredictionCard
                    data={data}
                    intent={intent}
                    confidence={confidence}
                    timestamp={timestamp}
                  />
                ) : (
                  <PredictionUnavailableBadge intent={intent} />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function IntroState({ onAsk }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-tint text-blue shadow-soft">
        <Bot className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-[18px] font-semibold tracking-tight text-navy sm:text-[20px]">
          ER Operations Companion
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-navy-soft">
          Ask questions about live patient volume, queue waiting times, crowding risk, and operational flow patterns.
        </p>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-bg p-3 text-left text-[13px] font-medium text-navy transition-all hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark shadow-soft"
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
  }, [messages]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await erflowApi.sendChatMessage(trimmed, sessionId, {});

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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main Chat Panel */}
        <PageCard
          title="ER Operations Companion"
          subtitle="Ask questions about patient demand, waiting times, crowding risk, and department operations."
          icon={Bot}
          className="flex min-w-0 flex-col xl:col-span-2"
        >
          <div className="flex h-[480px] flex-col gap-5 overflow-y-auto pr-1">
            {hasMessages ? (
              <>
                {messages.map((m) => (
                  <Bubble
                    key={m.id}
                    role={m.role}
                    text={m.text}
                    intent={m.intent}
                    confidence={m.confidence}
                    data={m.data}
                    timestamp={m.timestamp}
                    isError={m.isError}
                  />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-[13px] text-navy-soft italic">
                    <Loader2 className="h-4 w-4 animate-spin text-blue" />
                    Checking current ER conditions...
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
              placeholder="Ask about forecasts, crowding, waiting times…"
              disabled={loading}
              className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-[13.5px] text-navy placeholder:text-navy-soft focus:border-blue focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue text-white transition-colors hover:bg-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="rounded-xl border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-blue mb-1">
                  <Percent className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Occupancy</p>
                <p className="mt-0.5 text-[15px] font-bold text-navy">78%</p>
              </div>

              <div className="rounded-xl border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-teal mb-1">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Waiting</p>
                <p className="mt-0.5 text-[15px] font-bold text-navy">24 pts</p>
              </div>

              <div className="rounded-xl border border-border bg-bg p-3 text-center">
                <div className="flex justify-center text-red mb-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-navy-soft">Crowding</p>
                <p className="mt-0.5 text-[13px] font-bold text-red">CRITICAL</p>
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
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-left text-[13px] font-medium text-navy transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark disabled:opacity-50"
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
                  className="rounded-xl border border-border bg-bg px-3.5 py-2.5 text-left text-[12.5px] font-medium text-navy-muted transition-colors hover:border-blue/40 hover:bg-blue-tint hover:text-blue-dark disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </PageCard>

          {/* DATA USED FOR THIS RESPONSE (Secondary Metadata) */}
          <div className="rounded-2xl border border-border bg-surface shadow-soft">
            <button
              type="button"
              onClick={() => setContextOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              aria-expanded={contextOpen}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-tint text-blue">
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
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-3 py-2"
                  >
                    <span className="text-[12.5px] font-medium text-navy-muted">{item.label}</span>
                    <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-navy">
                      {item.model}
                    </span>
                  </div>
                ))}
                <p className="mt-1 text-[11.5px] leading-relaxed text-navy-soft">
                  The assistant explains and summarizes outputs from these underlying models — it does not generate predictions itself.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
