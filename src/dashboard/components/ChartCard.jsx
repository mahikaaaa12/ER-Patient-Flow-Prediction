import PageCard from "./PageCard";

// Thin, semantically-named wrapper around PageCard for chart sections.
// Kept separate from PageCard so chart-specific affordances (e.g. a
// footnote slot below the chart) can evolve without touching the
// generic card used for non-chart content.
export default function ChartCard({ title, subtitle, icon, action, className = "", footnote, children }) {
  return (
    <PageCard title={title} subtitle={subtitle} icon={icon} action={action} className={className}>
      {children}
      {footnote && <div className="mt-4">{footnote}</div>}
    </PageCard>
  );
}
