import { BedDouble, Clock, Percent, Stethoscope, TrendingUp, Users } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ChartCard from "../components/ChartCard";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import ModelBadge from "../components/ModelBadge";
import TrendChart from "../components/TrendChart";
import { WAITING_TIME_STATUS, OPERATIONAL_FACTORS, WAIT_TIME_TREND } from "../mockData";

export default function WaitingTime() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Waiting Time Prediction"
        subtitle="Predict expected patient waiting times using current ER load and historical patterns."
        action={<ModelBadge model={WAITING_TIME_STATUS.model} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current Average Wait" value={WAITING_TIME_STATUS.currentAvg} unit="min" tone="amber" />
        <MetricCard
          label="Predicted Wait in 1 Hour"
          value={WAITING_TIME_STATUS.predicted1h}
          unit="min"
          tone="amber"
        />
        <MetricCard label="Predicted Peak Wait" value={WAITING_TIME_STATUS.predictedPeak} unit="min" tone="red" />
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center shadow-soft">
          <p className="text-[12px] font-medium text-navy-soft">Trend</p>
          <StatusBadge label={WAITING_TIME_STATUS.trend} tone="amber" size="lg" trend="increasing" />
        </div>
      </div>

      <ChartCard
        title="Waiting Time Trend"
        subtitle="Average wait time across the day, with the final point projected"
        icon={Clock}
      >
        <TrendChart
          data={WAIT_TIME_TREND.map((d, i) => ({
            ...d,
            kind: i >= WAIT_TIME_TREND.length - 1 ? "forecast" : "observed",
          }))}
          height={240}
          color="var(--color-amber)"
          forecastColor="var(--color-red)"
          valueSuffix=" min"
          historicalLabel="Historical Data"
        />
      </ChartCard>

      <ChartCard
        title="Operational Factors"
        subtitle="Current conditions feeding the waiting-time model"
        icon={Users}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Patients Waiting" value={OPERATIONAL_FACTORS.patientsWaiting} icon={Users} tone="teal" />
          <MetricCard
            label="Available Beds"
            value={OPERATIONAL_FACTORS.availableBeds}
            icon={BedDouble}
            tone="blue"
          />
          <MetricCard
            label="Doctors Available"
            value={OPERATIONAL_FACTORS.doctorsAvailable}
            icon={Stethoscope}
            tone="green"
          />
          <MetricCard
            label="Current Arrival Rate"
            value={OPERATIONAL_FACTORS.arrivalRate}
            unit="/hour"
            icon={TrendingUp}
            tone="navy"
          />
          <MetricCard
            label="Current Occupancy"
            value={`${OPERATIONAL_FACTORS.occupancy}%`}
            icon={Percent}
            tone="amber"
          />
        </div>
      </ChartCard>
    </div>
  );
}
