import { Cpu } from "lucide-react";

// Small pill identifying the model behind a prediction module.
export default function ModelBadge({ model }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1 text-[11.5px] font-medium text-navy-muted">
      <Cpu className="h-3.5 w-3.5 text-blue" strokeWidth={2} aria-hidden="true" />
      <span className="text-navy-soft">Model:</span>
      <span className="font-mono font-semibold text-navy">{model}</span>
    </span>
  );
}
