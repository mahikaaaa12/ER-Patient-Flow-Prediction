// -----------------------------------------------------------------------
// Static mock data for the ER Operations Dashboard.
// Shapes are written to loosely mirror what future API responses might
// look like, so wiring up real endpoints later shouldn't require
// restructuring the components that consume this data.
// -----------------------------------------------------------------------

export const SYSTEM_STATUS = {
  state: "operational", // operational | degraded | offline
  label: "All Systems Operational",
  lastSync: "2 min ago",
};

export const NOTIFICATIONS = [
  {
    id: "n1",
    title: "Patient surge predicted",
    detail: "Arrivals expected to rise 34% over the next 3 hours.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: "n2",
    title: "Crowding risk elevated to HIGH",
    detail: "Projected between 6:00 PM and 9:00 PM tonight.",
    time: "22 min ago",
    unread: true,
  },
  {
    id: "n3",
    title: "Forecast model refreshed",
    detail: "Latest arrival forecast generated using updated data.",
    time: "1 hour ago",
    unread: false,
  },
  {
    id: "n4",
    title: "Weekly report available",
    detail: "Operational summary for the past 7 days is ready.",
    time: "Yesterday",
    unread: false,
  },
];

// ---------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------

export const SUMMARY_CARDS = [
  {
    id: "occupancy",
    label: "Current ER Occupancy",
    value: "78%",
    trend: "+6% vs. yesterday",
    trendDirection: "up",
    tone: "blue",
  },
  {
    id: "waiting",
    label: "Patients Currently Waiting",
    value: "24",
    trend: "+5 in the last hour",
    trendDirection: "up",
    tone: "teal",
  },
  {
    id: "wait-time",
    label: "Expected Waiting Time",
    value: "48 min",
    trend: "+12 min vs. average",
    trendDirection: "up",
    tone: "amber",
  },
  {
    id: "crowding",
    label: "Current Crowding Risk",
    value: "HIGH",
    trend: "Rising through evening",
    trendDirection: "up",
    tone: "red",
  },
];

// 24 hourly points: first 18 are "observed", last 6 are "forecast"
export const ARRIVAL_FORECAST_SERIES = [
  { t: "12 AM", value: 14, kind: "observed" },
  { t: "1 AM", value: 11, kind: "observed" },
  { t: "2 AM", value: 9, kind: "observed" },
  { t: "3 AM", value: 7, kind: "observed" },
  { t: "4 AM", value: 8, kind: "observed" },
  { t: "5 AM", value: 10, kind: "observed" },
  { t: "6 AM", value: 15, kind: "observed" },
  { t: "7 AM", value: 21, kind: "observed" },
  { t: "8 AM", value: 27, kind: "observed" },
  { t: "9 AM", value: 30, kind: "observed" },
  { t: "10 AM", value: 33, kind: "observed" },
  { t: "11 AM", value: 31, kind: "observed" },
  { t: "12 PM", value: 29, kind: "observed" },
  { t: "1 PM", value: 26, kind: "observed" },
  { t: "2 PM", value: 24, kind: "observed" },
  { t: "3 PM", value: 22, kind: "observed" },
  { t: "4 PM", value: 25, kind: "observed" },
  { t: "5 PM", value: 30, kind: "observed" },
  { t: "6 PM", value: 38, kind: "forecast" },
  { t: "7 PM", value: 46, kind: "forecast" },
  { t: "7:30 PM", value: 49, kind: "forecast" },
  { t: "8 PM", value: 45, kind: "forecast" },
  { t: "9 PM", value: 37, kind: "forecast" },
  { t: "10 PM", value: 28, kind: "forecast" },
];

export const FORECAST_CARDS = [
  { id: "1h", label: "Next 1 Hour", value: 15, unit: "patients" },
  { id: "3h", label: "Next 3 Hours", value: 42, unit: "patients" },
  { id: "6h", label: "Next 6 Hours", value: 78, unit: "patients" },
  { id: "24h", label: "Next 24 Hours", value: 236, unit: "patients" },
];

export const PREDICTED_PEAK = {
  time: "7:30 PM",
  detail: "Highest expected arrival volume in the next 24 hours",
};

export const ALERTS = [
  {
    id: "a1",
    severity: "high",
    title: "Patient Surge Expected",
    detail:
      "Patient arrivals are predicted to increase by 34% over the next 3 hours.",
  },
  {
    id: "a2",
    severity: "warning",
    title: "High Crowding Risk",
    detail: "ER crowding is expected to reach HIGH between 6 PM and 9 PM.",
  },
  {
    id: "a3",
    severity: "info",
    title: "Peak Demand Period",
    detail: "Highest patient volume is expected around 7:30 PM.",
  },
];

export const FLOW_SUMMARY = {
  pattern: "Busy Evening",
  confidence: 87,
  surgeStatus: "Abnormal Increase Detected",
};

export const AI_SUMMARY_TEXT =
  "Patient demand is expected to increase significantly over the next three hours. Current forecasts indicate a high risk of crowding between 6 PM and 9 PM, with waiting times potentially reaching approximately 60 minutes.";

// ---------------------------------------------------------------------
// Patient Forecast page
// ---------------------------------------------------------------------

// Forecast insights strip + time-range controls (24h / 7d / 30d) shown
// on the Patient Forecast page. Ranges reuse the same observed/forecast
// `kind` convention as ARRIVAL_FORECAST_SERIES above.
export const FORECAST_INSIGHTS = {
  peakTime: "7:30 PM",
  peakRate: 19,
  trend: "Increasing",
  model: "LSTM",
};

export const ARRIVAL_FORECAST_RANGES = {
  "24h": { label: "24 Hours", data: ARRIVAL_FORECAST_SERIES },
  "7d": {
    label: "7 Days",
    data: [
      { t: "Wed", value: 268, kind: "observed" },
      { t: "Thu", value: 241, kind: "observed" },
      { t: "Fri", value: 279, kind: "observed" },
      { t: "Sat", value: 312, kind: "observed" },
      { t: "Sun", value: 296, kind: "observed" },
      { t: "Mon", value: 258, kind: "observed" },
      { t: "Tue", value: 264, kind: "observed" },
      { t: "Wed (proj.)", value: 289, kind: "forecast" },
    ],
  },
  "30d": {
    label: "30 Days",
    data: [
      { t: "Week 1", value: 1780, kind: "observed" },
      { t: "Week 2", value: 1865, kind: "observed" },
      { t: "Week 3", value: 1732, kind: "observed" },
      { t: "Week 4", value: 1908, kind: "observed" },
      { t: "Week 5 (proj.)", value: 1994, kind: "forecast" },
    ],
  },
};

// ---------------------------------------------------------------------
// Waiting Time page
// ---------------------------------------------------------------------

export const WAITING_TIME_STATUS = {
  currentAvg: 48,
  predicted1h: 55,
  predictedPeak: 72,
  trend: "Increasing",
  model: "XGBoost Regressor",
};

export const OPERATIONAL_FACTORS = {
  patientsWaiting: 24,
  availableBeds: 8,
  doctorsAvailable: 5,
  arrivalRate: 10,
  occupancy: 78,
};

export const WAIT_TIME_SUMMARY = {
  current: 48,
  average7day: 36,
  target: 30,
};

export const WAIT_BY_TRIAGE = [
  { level: "Level 1 — Resuscitation", wait: 2, tone: "red" },
  { level: "Level 2 — Emergent", wait: 14, tone: "amber" },
  { level: "Level 3 — Urgent", wait: 41, tone: "blue" },
  { level: "Level 4 — Less Urgent", wait: 63, tone: "teal" },
  { level: "Level 5 — Non-Urgent", wait: 79, tone: "navy" },
];

export const WAIT_TIME_TREND = [
  { t: "12 AM", value: 22 },
  { t: "3 AM", value: 18 },
  { t: "6 AM", value: 24 },
  { t: "9 AM", value: 33 },
  { t: "12 PM", value: 37 },
  { t: "3 PM", value: 34 },
  { t: "6 PM", value: 44 },
  { t: "9 PM (proj.)", value: 60 },
];

// ---------------------------------------------------------------------
// Crowding Risk page
// ---------------------------------------------------------------------

export const CROWDING_RISK_SUMMARY = {
  level: "HIGH",
  score: 82,
  window: "6:00 PM – 9:00 PM",
};

// All four possible crowding risk levels, in ascending order of severity.
export const CROWDING_RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

export const CROWDING_RISK_TIMELINE = [
  { time: "3 PM", level: "MODERATE" },
  { time: "4 PM", level: "MODERATE" },
  { time: "5 PM", level: "HIGH" },
  { time: "6 PM", level: "HIGH" },
  { time: "7 PM", level: "CRITICAL" },
  { time: "8 PM", level: "HIGH" },
  { time: "9 PM", level: "MODERATE" },
];

export const CROWDING_CONTRIBUTING_FACTORS = {
  occupancy: 78,
  patientsWaiting: 24,
  expectedArrivals: 42,
  availableBeds: 8,
  predictedWait: 55,
};

export const CROWDING_MODEL = "XGBoost Classifier";

export const CROWDING_FACTORS = [
  { label: "Bed occupancy", value: 78, tone: "red" },
  { label: "Staffing ratio", value: 64, tone: "amber" },
  { label: "Predicted arrivals", value: 88, tone: "red" },
  { label: "Avg. length of stay", value: 55, tone: "amber" },
];

export const CROWDING_RISK_TREND = [
  { t: "12 AM", value: 20 },
  { t: "4 AM", value: 15 },
  { t: "8 AM", value: 38 },
  { t: "12 PM", value: 45 },
  { t: "4 PM", value: 52 },
  { t: "6 PM", value: 74 },
  { t: "8 PM", value: 82 },
  { t: "10 PM (proj.)", value: 68 },
];

export const NEDOCS_SCALE = [
  { range: "0–20", label: "Not Busy", tone: "green" },
  { range: "21–60", label: "Busy", tone: "teal" },
  { range: "61–100", label: "Overcrowded", tone: "amber" },
  { range: "101–140", label: "Severely Overcrowded", tone: "red" },
  { range: "141+", label: "Dangerously Overcrowded", tone: "red" },
];

// ---------------------------------------------------------------------
// Flow Patterns page
// ---------------------------------------------------------------------

export const FLOW_ANALYSIS_MODEL = "K-Means Clustering";

// Four representative demand patterns surfaced by the clustering model,
// each with a short list of defining characteristics.
export const FLOW_PATTERN_CARDS = [
  {
    id: "normal-period",
    name: "Normal Period",
    tone: "green",
    characteristics: ["Low arrivals", "Low waiting time", "High bed availability"],
  },
  {
    id: "busy-evening",
    name: "Busy Evening",
    tone: "amber",
    active: true,
    characteristics: ["High patient arrivals", "Moderate waiting time", "Reduced bed availability"],
  },
  {
    id: "weekend-peak",
    name: "Weekend Peak",
    tone: "blue",
    characteristics: ["High arrivals", "High occupancy", "Longer waiting times"],
  },
  {
    id: "extreme-demand",
    name: "Extreme Demand",
    tone: "red",
    characteristics: ["Very high arrivals", "Critical occupancy", "Severe waiting times"],
  },
];

// How frequently each pattern occurs across the historical dataset.
// Percentages sum to 100.
export const FLOW_PATTERN_DISTRIBUTION = [
  { label: "Normal Period", value: 42, tone: "green" },
  { label: "Busy Evening", value: 27, tone: "amber" },
  { label: "Weekend Peak", value: 18, tone: "blue" },
  { label: "Extreme Demand", value: 13, tone: "red" },
];

// Cluster centers for the scatter visualization (x = relative arrival
// volume, y = relative system strain — occupancy + wait pressure — both
// on an illustrative 0-100 scale).
export const FLOW_CLUSTERS = [
  { id: 0, name: "Normal Period", tone: "green", cx: 16, cy: 18 },
  { id: 1, name: "Busy Evening", tone: "amber", cx: 52, cy: 46 },
  { id: 2, name: "Weekend Peak", tone: "blue", cx: 72, cy: 66 },
  { id: 3, name: "Extreme Demand", tone: "red", cx: 90, cy: 88 },
];

// Deterministic jittered sample points around each cluster center,
// purely illustrative — not the output of an actual clustering model.
function seededJitter(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export const FLOW_CLUSTER_POINTS = FLOW_CLUSTERS.flatMap((cluster, ci) =>
  Array.from({ length: 11 }, (_, i) => {
    const seed = ci * 97 + i * 13.37;
    const jitterX = (seededJitter(seed) - 0.5) * 22;
    const jitterY = (seededJitter(seed + 5.5) - 0.5) * 22;
    return {
      id: `${cluster.id}-${i}`,
      clusterId: cluster.id,
      x: Math.min(98, Math.max(2, cluster.cx + jitterX)),
      y: Math.min(98, Math.max(2, cluster.cy + jitterY)),
    };
  })
);

// Today's live reading, plotted distinctly on top of the cluster field.
export const FLOW_CURRENT_POINT = { x: 55, y: 49, clusterId: 1 };

export const CURRENT_PATTERN = {
  name: "Busy Evening",
  confidence: 87,
  description:
    "Arrivals climb steadily from mid-afternoon, peak in the early evening, and taper off after 10 PM. Typical of weekday patterns with elevated ambulance volume.",
};

// ---------------------------------------------------------------------
// Surge Detection page
// ---------------------------------------------------------------------

export const SURGE_DETECTION_MODEL = "Isolation Forest";

export const SURGE_EXPLANATION =
  "The system compares current patient arrival behavior with historical patterns to identify unusual demand conditions.";

export const SURGE_STATUS = {
  status: "ANOMALOUS SURGE DETECTED",
  severity: "high",
  normalRateValue: "10–15",
  currentRateValue: "32",
  rateUnit: "patients/hr",
  deviation: "+113%",
  detectedAt: "6:30 PM",
  description:
    "Arrival volume over the last 60 minutes deviates significantly from the expected baseline for this time of day.",
};

export const SURGE_TIMELINE = [
  { t: "3 PM", expected: 13, actual: 14, anomaly: false },
  { t: "4 PM", expected: 14, actual: 15, anomaly: false },
  { t: "5 PM", expected: 14, actual: 18, anomaly: false },
  { t: "6 PM", expected: 15, actual: 27, anomaly: true },
  { t: "6:30 PM", expected: 15, actual: 32, anomaly: true },
  { t: "7 PM (proj.)", expected: 14, actual: 29, anomaly: true },
];

export const RECENT_SURGE_EVENTS = [
  { id: "s1", when: "Today — 6:30 PM", severity: "High", rate: "32 patients/hour" },
  { id: "s2", when: "Yesterday — 8:15 PM", severity: "Moderate", rate: "24 patients/hour" },
  { id: "s3", when: "July 18 — 7:45 PM", severity: "High", rate: "30 patients/hour" },
];

// ---------------------------------------------------------------------
// AI Assistant page
// ---------------------------------------------------------------------

export const AI_SUGGESTED_QUESTIONS = [
  "When will the ER be busiest today?",
  "What is the expected waiting time?",
  "Is a patient surge expected?",
  "Summarize today's patient flow.",
  "What is causing the high crowding risk?",
];

// Canned static responses keyed by suggested question — purely for
// front-end demo purposes, no live model calls are made. Each entry mirrors
// the shape a real API response would eventually return (`text` +
// `insights`), so swapping in a live call later only means replacing
// `getAssistantReply()` in AIAssistant.jsx — the rendering stays the same.
export const AI_CANNED_RESPONSES = {
  "When will the ER be busiest today?": {
    text:
      "Patient demand is expected to peak between 6:00 PM and 9:00 PM. The current forecast indicates approximately 42 patient arrivals over the next three hours, with crowding risk expected to increase to High.",
    insights: [
      { label: "Expected Arrivals", value: "42", icon: "Users", tone: "blue" },
      { label: "Peak Time", value: "7:30 PM", icon: "Clock", tone: "teal" },
      { label: "Crowding Risk", value: "HIGH", icon: "AlertTriangle", tone: "red" },
      { label: "Expected Wait", value: "55 min", icon: "Timer", tone: "amber" },
    ],
  },
  "What is the expected waiting time?": {
    text:
      "Average waiting time is currently projected at 55 minutes and trending upward as arrivals increase into the evening. Lower-acuity (Triage 4-5) patients are seeing the longest waits, while resuscitation and emergent cases continue to be seen immediately.",
    insights: [
      { label: "Expected Wait", value: "55 min", icon: "Timer", tone: "amber" },
      { label: "Wait Trend", value: "Increasing", icon: "TrendingUp", tone: "red" },
      { label: "Longest Wait Tier", value: "Triage 4-5", icon: "Users", tone: "blue" },
      { label: "Beds Occupied", value: "78%", icon: "Activity", tone: "teal" },
    ],
  },
  "Is a patient surge expected?": {
    text:
      "Yes. Arrivals over the last hour are running about 34% above the expected baseline, which has been flagged by the surge detector as an abnormal increase. This is being monitored closely alongside bed availability.",
    insights: [
      { label: "Surge Status", value: "Flagged", icon: "AlertTriangle", tone: "red" },
      { label: "Above Baseline", value: "+34%", icon: "TrendingUp", tone: "amber" },
      { label: "Detection Confidence", value: "91%", icon: "Cpu", tone: "blue" },
      { label: "Window", value: "Last 60 min", icon: "Clock", tone: "teal" },
    ],
  },
  "Summarize today's patient flow.": {
    text:
      "Arrivals are following a typical Busy Evening pattern with 87% confidence. Volume is expected to climb from 5:00 PM, peak near 7:30 PM at roughly 49 arrivals per hour, then taper off after 10:00 PM. Crowding risk rises to High during the peak window before easing overnight.",
    insights: [
      { label: "Flow Pattern", value: "Busy Evening", icon: "Activity", tone: "blue" },
      { label: "Pattern Confidence", value: "87%", icon: "Cpu", tone: "teal" },
      { label: "Peak Time", value: "7:30 PM", icon: "Clock", tone: "amber" },
      { label: "Crowding Risk", value: "HIGH", icon: "AlertTriangle", tone: "red" },
    ],
  },
  "What is causing the high crowding risk?": {
    text:
      "The largest contributors right now are predicted arrival volume (88/100) and current bed occupancy (78/100), with staffing ratio and average length of stay adding moderate additional pressure. Together these are pushing the overall crowding score into the High band.",
    insights: [
      { label: "Crowding Score", value: "82/100", icon: "AlertTriangle", tone: "red" },
      { label: "Top Factor", value: "Predicted Arrivals", icon: "Users", tone: "blue" },
      { label: "Bed Occupancy", value: "78%", icon: "Activity", tone: "amber" },
      { label: "Staffing Ratio", value: "Moderate", icon: "TrendingUp", tone: "teal" },
    ],
  },
};

// Static description of the underlying model pipeline the assistant draws
// on to explain outputs — shown in the "Data Used for This Response" panel.
export const AI_MODEL_CONTEXT = [
  { label: "Arrival Forecast", model: "LSTM" },
  { label: "Waiting Time", model: "XGBoost Regressor" },
  { label: "Crowding Risk", model: "XGBoost Classifier" },
  { label: "Flow Pattern", model: "K-Means" },
  { label: "Surge Detection", model: "Isolation Forest" },
];
