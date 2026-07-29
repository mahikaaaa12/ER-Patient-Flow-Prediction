import { Cpu } from "lucide-react";

// Small pill identifying the model behind a prediction module.
// Used consistently across forecast / waiting-time / crowding-risk pages.
export default function ModelBadge({ model }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[12.5px] font-semibold text-navy">
      <Cpu className="h-3.5 w-3.5 text-blue" strokeWidth={2.25} aria-hidden="true" />
      Model: <span className="font-mono font-semibold text-navy-muted">{model}</span>
    </span>
  );
}
