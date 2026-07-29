import { Activity, BedDouble, Clock, TrendingUp, UserCog, Users } from "lucide-react";

const PROBLEMS = [
  {
    icon: Activity,
    title: "Unpredictable Patient Arrivals",
    description:
      "ED arrivals fluctuate with little warning, making it hard to plan staffing and resources ahead of time.",
  },
  {
    icon: Clock,
    title: "Long Waiting Times",
    description:
      "Patients wait longer than necessary when staff have no advance signal that demand is about to climb.",
  },
  {
    icon: Users,
    title: "ED Overcrowding",
    description:
      "Arrivals cluster unpredictably, pushing the department past safe capacity with little warning.",
  },
  {
    icon: BedDouble,
    title: "Bed Shortages",
    description:
      "Without a forecast, bed availability is managed reactively instead of planned ahead of the surge.",
  },
  {
    icon: UserCog,
    title: "Staffing Pressure",
    description:
      "Shift planning is based on averages, leaving teams understaffed during unanticipated demand spikes.",
  },
  {
    icon: TrendingUp,
    title: "Unexpected Patient Surges",
    description:
      "Sudden spikes in demand catch departments off guard, straining capacity before anyone can react.",
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="relative border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-3 py-1.5 text-[13px] font-medium text-navy-muted">
            The Problem
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-navy sm:text-4xl">
            Emergency Departments Shouldn&apos;t Have to React to Overcrowding.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-navy-muted">
            Unpredictable patient demand puts pressure on every part of the department,
            long before anyone sees it coming.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-5 shadow-soft transition-shadow hover:shadow-lift"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-tint text-red">
                <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <p className="text-[15px] font-semibold text-navy">{title}</p>
              <p className="text-[13px] leading-relaxed text-navy-muted">{description}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 text-center">
          <div className="vital-rule max-w-xs" />
          <p className="text-2xl font-semibold tracking-tight text-navy sm:text-[28px]">
            What if hospitals could see the surge coming?
          </p>
          <div className="vital-rule max-w-xs" />
        </div>
      </div>
    </section>
  );
}
