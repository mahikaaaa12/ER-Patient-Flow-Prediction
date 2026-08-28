import {
  BrainCircuit,
  Database,
  Layers,
  MonitorSmartphone,
  Server,
  Sparkles,
  Workflow,
} from "lucide-react";

const CATEGORIES = [
  {
    key: "ml",
    label: "Machine Learning",
    icon: Workflow,
    accent: "blue",
    items: ["Scikit-learn", "XGBoost"],
  },
  {
    key: "dl",
    label: "Deep Learning",
    icon: BrainCircuit,
    accent: "green",
    items: ["TensorFlow / Keras", "LSTM"],
  },
  {
    key: "data",
    label: "Data",
    icon: Layers,
    accent: "teal",
    items: ["Python", "Pandas", "NumPy"],
  },
  {
    key: "backend",
    label: "Backend",
    icon: Server,
    accent: "navy",
    items: ["Django"],
  },
  {
    key: "database",
    label: "Database",
    icon: Database,
    accent: "amber",
    items: ["PostgreSQL"],
  },
  {
    key: "ai",
    label: "AI",
    icon: Sparkles,
    accent: "blue",
    items: ["LLM Integration", "Optional RAG"],
  },
  {
    key: "frontend",
    label: "Frontend",
    icon: MonitorSmartphone,
    accent: "teal",
    items: ["React", "Tailwind CSS"],
  },
];

const ACCENT_CLASSES = {
  blue: { text: "text-blue", bg: "bg-blue-tint" },
  teal: { text: "text-teal", bg: "bg-teal-tint" },
  green: { text: "text-green", bg: "bg-green-tint" },
  amber: { text: "text-amber", bg: "bg-amber-tint" },
  navy: { text: "text-navy", bg: "bg-bg" },
};

export default function TechnologyStack() {
  return (
    <section id="technology" className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-teal">
            Technology Stack
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            Built on a Proven, Production-Ready Stack
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            ERFlow combines established machine learning and web technologies,
            chosen for reliability at hospital scale.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map(({ key, label, icon: Icon, accent, items }) => {
            const accentClasses = ACCENT_CLASSES[accent];
            return (
              <div
                key={key}
                className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5 shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border ${accentClasses.bg} ${accentClasses.text}`}>
                    <Icon className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <p className="text-[14px] font-semibold text-navy">{label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[12px] font-medium text-navy-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
