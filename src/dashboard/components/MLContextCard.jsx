import { Clock, Cpu, Eye, Target } from "lucide-react";

export default function MLContextCard({
  sees = [],
  predicts = "",
  when = "",
  source = "",
  className = "",
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-3.5 shadow-soft ${className}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* WHAT THE MODEL SEES */}
        <div className="flex flex-col justify-between rounded-md border border-border bg-bg p-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">
              <Eye className="h-3.5 w-3.5 text-blue" />
              <span>WHAT THE MODEL SEES</span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-[12px] font-medium text-navy">
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
        <div className="flex flex-col justify-between rounded-md border border-border bg-bg p-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">
              <Target className="h-3.5 w-3.5 text-teal" />
              <span>WHAT IT PREDICTS</span>
            </div>
            <p className="mt-2 font-mono text-[14px] font-bold text-navy">
              {predicts || "Prediction unavailable"}
            </p>
          </div>
        </div>

        {/* WHEN */}
        <div className="flex flex-col justify-between rounded-md border border-border bg-bg p-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">
              <Clock className="h-3.5 w-3.5 text-amber-dark" />
              <span>WHEN</span>
            </div>
            <p className="mt-2 text-[13px] font-semibold text-navy">
              {when || "Live Window"}
            </p>
          </div>
        </div>

        {/* SOURCE */}
        <div className="flex flex-col justify-between rounded-md border border-border bg-bg p-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-navy-soft">
              <Cpu className="h-3.5 w-3.5 text-purple" />
              <span>SOURCE</span>
            </div>
            <p className="mt-2 truncate font-mono text-[12.5px] font-bold text-navy" title={source}>
              {source || "Trained ML Model"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
