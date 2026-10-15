import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOperationalReport } from "../src/dashboard/utils/reportParser.js";

describe("ERFlow Operational Report Presentation Suite", () => {
  // Test Case 1: Biggest current operational issue
  describe("1. Biggest Current Operational Issue Report", () => {
    it("formats command center response with executive summary, metrics, findings, and actions", () => {
      const mockPayload = {
        pressure_level: "HIGH",
        overall_pressure_score: 74.0,
        workload_assessment: {
          bed_occupancy_percent: 78.0,
          doctor_load_ratio: 4.8,
          nurse_load_ratio: 2.4,
          upcoming_3h_workload_level: "HIGH",
          primary_driver: "Triage Intake Volume & High Bed Occupancy",
          contributing_factors: [
            { name: "Bed Occupancy", score: 85, severity: "HIGH", detail: "Inpatient beds approaching 80% threshold." },
            { name: "Triage Queue", score: 78, severity: "HIGH", detail: "24 patients in intake queue." },
          ],
        },
        prioritized_issues: [
          { severity: "HIGH", category: "OPERATIONS", title: "Demand Pressure", description: "Elevated queue backlog with 78% bed occupancy." },
        ],
        recommended_actions: [
          {
            title: "Deploy Float Nurse to Triage Intake",
            recommended_action: "Deploy 1 float nurse to triage zone to absorb intake backlog.",
            priority: "High",
            urgency: "WITHIN 30 MIN",
            expected_impact: "Reduces nurse ratio from 2.4 to 1.8.",
            target_role: "Charge Nurse",
          },
        ],
      };

      const report = parseOperationalReport({
        text: "⚡ **ED Operations Command Center Assessment**:\n• **Overall Pressure**: HIGH (74/100 index)\n• **Bed Occupancy**: 78%",
        intent: "OPERATIONAL_COMMAND",
        confidence: 0.95,
        data: mockPayload,
        timestamp: "2026-10-15T09:30:00Z",
      });

      assert.equal(report.category, "OPERATIONAL COMMAND");
      assert.equal(report.title, "ED Operations Command Center Assessment");
      assert.equal(report.tone, "red");
      assert.equal(report.statusBadge.label, "HIGH PRESSURE");
      assert.ok(report.summary.headline.includes("HIGH"));
      assert.ok(report.summary.headline.includes("74/100"));

      // Verify metrics
      const labels = report.metrics.map((m) => m.label);
      assert.ok(labels.includes("Pressure Index"));
      assert.ok(labels.includes("Bed Occupancy"));
      assert.ok(labels.includes("MD Workload Ratio"));
      assert.ok(labels.includes("RN Workload Ratio"));

      const occMetric = report.metrics.find((m) => m.label === "Bed Occupancy");
      assert.equal(occMetric.value, 78);
      assert.equal(occMetric.unit, "%");

      // Verify findings
      assert.ok(report.findings.length >= 2);
      assert.ok(report.findings[0].includes("Demand Pressure"));

      // Verify recommendations
      assert.equal(report.actions.length, 1);
      assert.equal(report.actions[0].priority, "High");
      assert.equal(report.actions[0].urgency, "WITHIN 30 MIN");
      assert.ok(report.actions[0].why.includes("Reduces nurse ratio"));
    });
  });

  // Test Case 2: Workload explanation
  describe("2. Workload Driver Explanation Report", () => {
    it("formats workload explanation with ratio metrics and driver breakdown", () => {
      const mockPayload = {
        pressure_level: "MODERATE",
        overall_pressure_score: 58.0,
        workload_assessment: {
          bed_occupancy_percent: 72.0,
          doctor_load_ratio: 3.5,
          nurse_load_ratio: 2.1,
          upcoming_3h_workload_level: "MODERATE",
          primary_driver: "Intake Velocity exceeding discharge rate",
          contributing_factors: [
            { name: "Arrival Pace", detail: "Arrival rate at 28 pts/hr." },
          ],
        },
        prioritized_issues: [
          { severity: "MODERATE", category: "STAFFING", title: "Intake Demand", description: "Elevated provider workload." },
        ],
        recommended_actions: [
          {
            title: "Pace Triage Intake",
            recommended_action: "Expedite low acuity discharges.",
            priority: "Moderate",
            urgency: "Within 1 Hour",
            expected_impact: "Stabilizes bed turnover.",
          },
        ],
      };

      const report = parseOperationalReport({
        text: "The primary factors driving workload are high arrival rates and bed boarding.",
        intent: "OPERATIONAL_COMMAND",
        confidence: 0.90,
        data: mockPayload,
      });

      assert.equal(report.category, "OPERATIONAL COMMAND");
      assert.equal(report.tone, "amber");
      assert.ok(report.summary.text.toLowerCase().includes("moderate"));
      const docMetric = report.metrics.find((m) => m.label === "MD Workload Ratio");
      assert.equal(docMetric.value, 3.5);
      assert.equal(docMetric.unit, "pts/MD");
    });
  });

  // Test Case 3: Waiting-time risk
  describe("3. Waiting-Time Risk Report", () => {
    it("formats waiting time predictions with acuity level, confidence, and XGBoost factors", () => {
      const mockPayload = {
        estimated_wait_minutes: 42.0,
        predicted_peak: 55.0,
        triage_level: "Standard",
        adapter: "XGBoost Regressor",
        confidence: 0.88,
        explanation: {
          top_factors: [
            { feature: "Queue size", importance: 0.45 },
            { feature: "Bed availability", importance: 0.32 },
          ],
        },
      };

      const report = parseOperationalReport({
        text: "The waiting-time model estimates approximately **42 minutes** for **Standard** triage.",
        intent: "WAITING_TIME",
        confidence: 0.88,
        data: mockPayload,
      });

      assert.equal(report.category, "PATIENT FLOW & TRIAGE");
      assert.equal(report.title, "Triage Waiting Time Risk Assessment");
      assert.ok(report.summary.headline.includes("42 Minutes"));
      assert.ok(report.summary.headline.includes("Standard"));

      const waitMetric = report.metrics.find((m) => m.label === "Estimated Wait");
      assert.equal(waitMetric.value, 42);
      assert.equal(waitMetric.unit, "mins");

      const peakMetric = report.metrics.find((m) => m.label === "Forecasted Peak");
      assert.equal(peakMetric.value, 55);
      assert.equal(peakMetric.unit, "mins");

      assert.equal(report.forecast.model, "XGBoost Regressor");
      assert.ok(report.findings.some((f) => f.includes("Queue size")));
    });
  });

  // Test Case 4: Crowding forecast
  describe("4. Crowding Forecast Report", () => {
    it("formats crowding classification with probability and occupancy metrics", () => {
      const mockPayload = {
        crowding_level: "High",
        class_probability: 0.84,
        occupancy_percent: 78.0,
        adapter: "XGBoost Classifier",
      };

      const report = parseOperationalReport({
        text: "The crowding model predicts **HIGH** risk, with an estimated class probability of 84%.",
        intent: "CROWDING",
        confidence: 0.84,
        data: mockPayload,
      });

      assert.equal(report.category, "CROWDING RISK");
      assert.equal(report.tone, "red");
      assert.equal(report.statusBadge.label, "HIGH CROWDING");
      assert.ok(report.summary.headline.includes("HIGH"));

      const levelMetric = report.metrics.find((m) => m.label === "Crowding Level");
      assert.equal(levelMetric.value, "HIGH");

      const probMetric = report.metrics.find((m) => m.label === "Class Probability");
      assert.equal(probMetric.value, "84%");

      assert.equal(report.forecast.horizon, "Next 3 Hours");
    });
  });

  // Test Case 5: Surge detection
  describe("5. Surge Detection Report", () => {
    it("formats DBSCAN anomaly detection alert with urgency actions", () => {
      const mockPayload = {
        is_high_demand_expected: true,
        status: "ANOMALOUS SURGE DETECTED",
        severity: "High",
        risk_level: "High",
        window: "next 3 hours",
        adapter: "Operational Surge & Anomaly Detector",
      };

      const report = parseOperationalReport({
        text: "High Demand Alert: The high-demand model predicts **ANOMALOUS SURGE DETECTED** (High demand risk).",
        intent: "HIGH_DEMAND_PERIOD",
        confidence: 0.95,
        data: mockPayload,
      });

      assert.equal(report.category, "SURGE DETECTION");
      assert.equal(report.tone, "red");
      assert.equal(report.statusBadge.label, "ANOMALOUS SURGE DETECTED");
      assert.ok(report.summary.headline.includes("ANOMALOUS SURGE DETECTED"));

      const surgeMetric = report.metrics.find((m) => m.label === "Surge Status");
      assert.equal(surgeMetric.value, "SURGE");

      assert.ok(report.actions.some((a) => a.priority === "Critical"));
    });
  });

  // Test Case 6: Triage guidance (ESI level 1)
  describe("6. Triage Protocol Guidance Report (ESI Level 1)", () => {
    it("formats ESI Level 1 clinical guidelines with critical escalation warning and document sources", () => {
      const report = parseOperationalReport({
        text: "The Emergency Severity Index (ESI) Level 1 is assigned to patients with immediate life-threatening conditions.\n\n### Clinical Criteria\n- Cardiac arrest\n- Severe respiratory failure\n- Profound anaphylaxis\n\n**Sources:**\n- ER Triage Protocol Guidelines.pdf",
        intent: "KNOWLEDGE_QUERY",
        confidence: 0.95,
        data: {
          rag_retrieval: true,
          sources: ["ER Triage Protocol Guidelines.pdf"],
          confidence_score: 0.92,
        },
      });

      assert.equal(report.category, "CLINICAL TRIAGE GUIDELINES");
      assert.equal(report.title, "Emergency Severity Index (ESI) Level 1 Protocol");
      assert.equal(report.tone, "red");
      assert.ok(report.alertBanner !== null);
      assert.equal(report.alertBanner.title, "CRITICAL ESCALATION CAVEAT");
      assert.ok(report.alertBanner.message.includes("Do not delay resuscitation"));
      assert.ok(report.knowledge.sources.includes("ER Triage Protocol Guidelines.pdf"));
      assert.ok(report.markdownBody.includes("Cardiac arrest"));
    });
  });

  // Test Case 7: Missing or unavailable ML outputs
  describe("7. Missing or Unavailable ML Output Handling", () => {
    it("handles validation failure gracefully without throwing or inventing values", () => {
      const report = parseOperationalReport({
        text: "Please specify requested date or triage acuity parameters.",
        intent: "WAITING_TIME",
        confidence: 0.0,
        data: { validation_failed: true, clarification_needed: true },
      });

      assert.equal(report.category, "MODEL INPUT VALIDATION");
      assert.equal(report.tone, "amber");
      assert.equal(report.statusBadge.label, "CLARIFICATION NEEDED");
      assert.equal(report.metrics.length, 0); // No fabricated numbers
      assert.ok(report.limitations.note.includes("paused"));
    });
  });

  // Test Case 8: Backend unavailable errors
  describe("8. Backend Unavailable Errors", () => {
    it("formats service unavailable error with troubleshooting guidance", () => {
      const report = parseOperationalReport({
        text: "The ERFlow assistant is temporarily unavailable. Please try again.",
        intent: "SERVICE_UNAVAILABLE",
        confidence: 0,
        data: null,
        isError: true,
      });

      assert.equal(report.category, "SYSTEM STATUS");
      assert.equal(report.tone, "red");
      assert.equal(report.statusBadge.label, "OFFLINE");
      assert.ok(report.summary.headline.includes("Temporarily Unreachable"));
      assert.ok(report.limitations.stale);
      assert.equal(report.metrics.length, 0); // Honest - no fabricated numbers
    });
  });

  // Test Case 9: Long multi-section reports
  describe("9. Long Multi-Section Operational Command Reports", () => {
    it("preserves all sections: header, summary, metrics, findings, actions, forecast, and limitations", () => {
      const mockPayload = {
        pressure_level: "CRITICAL",
        overall_pressure_score: 88.0,
        workload_assessment: {
          bed_occupancy_percent: 92.0,
          doctor_load_ratio: 5.5,
          nurse_load_ratio: 3.2,
          upcoming_3h_workload_level: "CRITICAL",
          primary_driver: "Severe inpatient bed block with emergency intake surge",
          contributing_factors: [
            { name: "Bed Saturation", detail: "Inpatient floor census at 98%." },
            { name: "Intake Spike", detail: "Ambulance arrivals +35% above average." },
            { name: "Nurse Shortage", detail: "2 nurses on sick leave." },
          ],
        },
        prioritized_issues: [
          { severity: "CRITICAL", category: "CAPACITY", title: "Full Capacity Saturation", description: "ED beds at 92% occupancy." },
        ],
        recommended_actions: [
          {
            title: "Declare Hospital Code Orange / Full Capacity Protocol",
            recommended_action: "Initiate emergency inpatient bed clearing.",
            priority: "Critical",
            urgency: "Immediate",
            expected_impact: "Frees 8 acute care beds within 45 minutes.",
            target_role: "Chief Medical Officer",
          },
          {
            title: "Divert BLS Ambulances",
            recommended_action: "Request BLS diversion to regional partner facilities.",
            priority: "High",
            urgency: "Within 15 Min",
            expected_impact: "Halts incoming non-critical arrivals.",
            target_role: "Medical Director",
          },
        ],
      };

      const report = parseOperationalReport({
        text: "Critical command report text",
        intent: "OPERATIONAL_COMMAND",
        confidence: 0.98,
        data: mockPayload,
      });

      assert.equal(report.tone, "red");
      assert.equal(report.statusBadge.label, "CRITICAL PRESSURE");
      assert.equal(report.metrics.length, 4);
      assert.ok(report.findings.length >= 4);
      assert.equal(report.actions.length, 2);
      assert.ok(report.forecast !== null);
      assert.ok(report.limitations !== null);
    });
  });

  // Test Case 10: Markdown containing bold text, lists, and headings
  describe("10. General / Informational Markdown Response", () => {
    it("retains markdown text for safe rendering without raw syntax distortion", () => {
      const markdownSample = `### Operational Summary
- **Current Status**: Normal throughput
- **Active Zones**: Triage, Acute Bay A, Resus

1. Monitor intake queue pacing
2. Verify nurse shift handoff

\`Telemetry engine: XGBoost v1.2\``;

      const report = parseOperationalReport({
        text: markdownSample,
        intent: "GENERAL",
        confidence: 0.90,
      });

      assert.equal(report.category, "OPERATIONAL ASSISTANT");
      assert.ok(report.markdownBody.includes("### Operational Summary"));
      assert.ok(report.markdownBody.includes("**Current Status**"));
      assert.ok(report.markdownBody.includes("`Telemetry engine: XGBoost v1.2`"));
    });
  });
});
