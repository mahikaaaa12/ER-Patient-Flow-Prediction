import { Clock, Cpu, Eye, Target } from "lucide-react";

export default function MLContextCard({
  sees = [],
  predicts = "",
  when = "",
  source = "",
  className = "",
}) {
  return (
    <div className={`rounded-2xl border border-blue/20 bg-blue-tint/30 p-4 shadow-soft ${className}`}>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* WHAT THE MODEL SEES */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-soft">
              <Eye className="h-3.5 w-3.5 text-blue" />
              <span>WHAT THE MODEL SEES</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] font-medium text-navy">
              {sees && sees.length > 0 ? (
                sees.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
                    <span className="truncate">{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-navy-soft italic">Standard inputs</li>
              )}
            </ul>
          </div>
        </div>

        {/* WHAT IT PREDICTS */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-soft">
              <Target className="h-3.5 w-3.5 text-teal" />
              <span>WHAT IT PREDICTS</span>
            </div>
            <p className="mt-2.5 font-mono text-[15px] font-bold text-navy">
              {predicts || "Prediction unavailable"}
            </p>
          </div>
        </div>

        {/* WHEN */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-soft">
              <Clock className="h-3.5 w-3.5 text-amber" />
              <span>WHEN</span>
            </div>
            <p className="mt-2.5 text-[13.5px] font-semibold text-navy">
              {when || "Live Window"}
            </p>
          </div>
        </div>

        {/* SOURCE */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-3.5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-navy-soft">
              <Cpu className="h-3.5 w-3.5 text-purple" />
              <span>SOURCE</span>
            </div>
            <p className="mt-2.5 truncate font-mono text-[13px] font-bold text-navy" title={source}>
              {source || "Trained ML Model"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
