import { HelpCircle } from "lucide-react";

export const GLOSSARY = {
  occupancy: "Percentage of licensed ER beds currently occupied by active patients.",
  crowding_risk: "Overall department crowding strain level predicted by the XGBoost Classifier.",
  forecast: "Projected patient arrival count over the specified time horizon.",
  arrival_rate: "Number of new patient arrivals entering the emergency department per hour.",
  flow_pattern: "Operational demand cluster identified from historical patient flow trends.",
  waiting_time: "Estimated duration a non-critical patient will wait before physician evaluation.",
};

export default function Tooltip({ term, text, children }) {
  const explanation = text || (term ? GLOSSARY[term] : null);
  if (!explanation) return <>{children}</>;

  return (
    <span className="group relative inline-flex items-center gap-1 cursor-help" title={explanation}>
      {children}
      <HelpCircle className="h-3.5 w-3.5 text-navy-soft/60 transition-colors group-hover:text-blue" />
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-normal rounded-lg bg-navy px-3 py-1.5 text-[11.5px] font-normal text-white shadow-lift group-hover:block z-30 max-w-xs text-center leading-tight">
        {explanation}
      </span>
    </span>
  );
}
