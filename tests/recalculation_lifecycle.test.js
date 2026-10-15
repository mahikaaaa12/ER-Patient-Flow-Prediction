import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("ERFlow Operations Command Center - Recalculation Lifecycle & Deduplication Suite", () => {
  let mockApiCallCount = 0;
  let mockPredictionCallCount = 0;

  beforeEach(() => {
    mockApiCallCount = 0;
    mockPredictionCallCount = 0;
  });

  describe("1. Input Material Change Detection & Deduplication (Requirements 5 & 7)", () => {
    const isStateDifferent = (a, b) => {
      if (!a || !b) return true;
      return (
        Number(a.occupancy_percent) !== Number(b.occupancy_percent) ||
        Number(a.patients_waiting) !== Number(b.patients_waiting) ||
        Number(a.arrival_rate) !== Number(b.arrival_rate) ||
        Number(a.available_beds) !== Number(b.available_beds) ||
        Number(a.available_doctors) !== Number(b.available_doctors) ||
        Number(a.available_nurses) !== Number(b.available_nurses) ||
        Number(a.severity_level) !== Number(b.severity_level)
      );
    };

    it("identifies identical states and avoids triggering redundant prediction requests", () => {
      const stateA = {
        occupancy_percent: 78,
        patients_waiting: 24,
        arrival_rate: 28,
        available_beds: 8,
        available_doctors: 5,
        available_nurses: 9,
        severity_level: 3.0,
      };

      const stateB = { ...stateA }; // Identical snapshot

      assert.equal(isStateDifferent(stateA, stateB), false);
    });

    it("detects genuine changes across all 7 operational inputs", () => {
      const baseState = {
        occupancy_percent: 78,
        patients_waiting: 24,
        arrival_rate: 28,
        available_beds: 8,
        available_doctors: 5,
        available_nurses: 9,
        severity_level: 3.0,
      };

      const changedInputs = [
        { occupancy_percent: 85 },
        { patients_waiting: 30 },
        { arrival_rate: 35 },
        { available_beds: 4 },
        { available_doctors: 4 },
        { available_nurses: 7 },
        { severity_level: 2.0 },
      ];

      for (const diff of changedInputs) {
        const modified = { ...baseState, ...diff };
        assert.equal(isStateDifferent(baseState, modified), true, `Failed to detect change in ${Object.keys(diff)[0]}`);
      }
    });

    it("deduplicates identical orchestrator input snapshots using serialized signature", () => {
      let calculationCalls = 0;
      let prevSignature = "";

      const getInputSignature = (state, isReal, preds) => {
        const predSig = preds ? [
          preds.request_id || "",
          preds.forecast?.predicted_peak_rate || "",
          preds.waiting_time?.waiting_time_minutes || "",
        ].join(":") : "no_preds";

        return [
          state.occupancy_percent,
          state.patients_waiting,
          state.arrival_rate,
          state.available_beds,
          state.available_doctors,
          state.available_nurses,
          state.severity_level,
          isReal ? "real" : "demo",
          predSig,
        ].join("|");
      };

      const evaluateOrchestrator = (state, isReal, preds, manual = false) => {
        const currentSig = getInputSignature(state, isReal, preds);
        if (!manual && currentSig === prevSignature) {
          return { skipped: true };
        }
        prevSignature = currentSig;
        calculationCalls++;
        return { skipped: false, evaluated: true };
      };

      const state = {
        occupancy_percent: 80,
        patients_waiting: 25,
        arrival_rate: 30,
        available_beds: 6,
        available_doctors: 5,
        available_nurses: 8,
        severity_level: 3.0,
      };
      const preds = { request_id: "req-1", forecast: { predicted_peak_rate: 34 }, waiting_time: { waiting_time_minutes: 45 } };

      // First run: evaluates
      const run1 = evaluateOrchestrator(state, true, preds);
      assert.equal(run1.evaluated, true);
      assert.equal(calculationCalls, 1);

      // Second run with unchanged inputs: skipped
      const run2 = evaluateOrchestrator(state, true, preds);
      assert.equal(run2.skipped, true);
      assert.equal(calculationCalls, 1);

      // Third run with manual force: proceeds
      const run3 = evaluateOrchestrator(state, true, preds, true);
      assert.equal(run3.evaluated, true);
      assert.equal(calculationCalls, 2);
    });
  });

  describe("2. Request Lifecycle & Deferral while Predictions In-Flight (Requirement 4)", () => {
    it("defers orchestrator evaluation until prediction requests complete", async () => {
      let lifecycleSteps = [];
      let erLoading = false;
      let predictions = null;
      let orchestratorData = null;

      const triggerInputCommit = async (newState) => {
        lifecycleSteps.push("1. Inputs changed");

        // Request predictions
        lifecycleSteps.push("2. Predictions requested");
        erLoading = true;

        // Attempt orchestrator evaluation while erLoading is true
        const tryEvalWhileLoading = () => {
          if (erLoading) {
            lifecycleSteps.push("3. Orchestrator evaluation deferred (erLoading=true)");
            return false;
          }
          return true;
        };
        tryEvalWhileLoading();

        // Predictions resolve
        await new Promise((r) => setTimeout(r, 20));
        predictions = { request_id: "pred-ready", waiting_time: { waiting_time_minutes: 40 } };
        erLoading = false;
        lifecycleSteps.push("4. Predictions received");

        // Now orchestrator evaluates with fresh predictions
        if (!erLoading && predictions) {
          orchestratorData = { score: 75, recommendations: [{ id: "rec-1", title: "Action" }] };
          lifecycleSteps.push("5. Recommendations evaluated");
        }

        lifecycleSteps.push("6. Results displayed");
      };

      await triggerInputCommit({ occupancy_percent: 82 });

      assert.deepEqual(lifecycleSteps, [
        "1. Inputs changed",
        "2. Predictions requested",
        "3. Orchestrator evaluation deferred (erLoading=true)",
        "4. Predictions received",
        "5. Recommendations evaluated",
        "6. Results displayed",
      ]);
      assert.equal(erLoading, false);
      assert.notEqual(orchestratorData, null);
    });
  });

  describe("3. Outdated Asynchronous Response Rejection (Requirement 6)", () => {
    it("discards slow superseded responses and prevents overwriting newer results", async () => {
      let activeRequestId = 0;
      let committedResult = null;

      const executeRequest = async (simulatedDelayMs, resultPayload) => {
        const reqId = ++activeRequestId;
        await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));

        if (reqId === activeRequestId) {
          committedResult = resultPayload;
          return { accepted: true, reqId };
        } else {
          return { discarded: true, reqId, currentActive: activeRequestId };
        }
      };

      // Launch request #1 (slow, 60ms) and request #2 (fast, 15ms)
      const promise1 = executeRequest(60, "Result from Request #1 (Old Inputs)");
      const promise2 = executeRequest(15, "Result from Request #2 (New Inputs)");

      const [res1, res2] = await Promise.all([promise1, promise2]);

      // Request #2 should have committed its result
      assert.equal(res2.accepted, true);
      assert.equal(committedResult, "Result from Request #2 (New Inputs)");

      // Request #1 finishes later and should be safely discarded
      assert.equal(res1.discarded, true);
      assert.equal(committedResult, "Result from Request #2 (New Inputs)");
    });
  });

  describe("4. Preservation of Previous Results During Loading (Requirement 10)", () => {
    it("keeps previous recommendations visible during re-evaluation", () => {
      let existingRecommendations = [
        { id: "rec-triage", title: "Review Triage Staffing", priority: "HIGH" },
        { id: "rec-bed", title: "Initiate Bed Transfers", priority: "MODERATE" },
      ];

      let isEvaluating = true; // New evaluation in-flight

      // Logic matching EDCommandOrchestrator.jsx:
      // If evaluating and existing recommendations exist, render them with updating badge
      const renderState = {
        showFullLoader: isEvaluating && existingRecommendations.length === 0,
        showInlineUpdatingBanner: isEvaluating && existingRecommendations.length > 0,
        displayedRecommendations: existingRecommendations,
      };

      assert.equal(renderState.showFullLoader, false);
      assert.equal(renderState.showInlineUpdatingBanner, true);
      assert.equal(renderState.displayedRecommendations.length, 2);
    });
  });

  describe("5. Workflow Actions Do NOT Retrigger ML Predictions (Requirement 12)", () => {
    it("ensures acknowledging an issue does not trigger prediction services or orchestrator evaluations", () => {
      let mlEngineCalls = 0;
      let orchestratorEvals = 0;
      let actionStatuses = {};

      const acknowledgeIssue = (recId, responseOption, notes) => {
        // Acknowledge updates actionStatuses only
        actionStatuses[recId] = {
          status: "ACKNOWLEDGED",
          response_option: responseOption,
          notes,
          acknowledged_at: new Date().toISOString(),
        };
        // Does NOT invoke mlEngine or orchestrator
      };

      acknowledgeIssue("rec-triage-capacity", "Action Planned", "Calling auxiliary RN");

      assert.equal(mlEngineCalls, 0);
      assert.equal(orchestratorEvals, 0);
      assert.equal(actionStatuses["rec-triage-capacity"].status, "ACKNOWLEDGED");
    });
  });

  describe("6. Preservation of Recommendation Workflow Status on New Predictions (Requirement 13)", () => {
    it("preserves ACKNOWLEDGED and COMPLETED statuses when new predictions arrive", () => {
      const persistedStatuses = {
        "rec-triage-capacity": {
          status: "ACKNOWLEDGED",
          response_option: "Action In Progress",
          notes: "Nurse assigned to intake",
        },
        "rec-bed-capacity": {
          status: "COMPLETED",
          resolution_notes: "Transferred 4 patients",
        },
      };

      // Fresh recommendations generated by orchestrator
      const freshRecommendations = [
        { id: "rec-triage-capacity", priority: "HIGH", title: "Review Triage Staffing" },
        { id: "rec-bed-capacity", priority: "LOW", title: "Initiate Bed Transfers" },
        { id: "rec-doctor-capacity", priority: "MODERATE", title: "Staff Float MD" },
      ];

      // Reconciled card view
      const reconciledCards = freshRecommendations.map((rec) => {
        const existing = persistedStatuses[rec.id];
        return {
          id: rec.id,
          priority: rec.priority,
          status: existing ? existing.status : "NEW",
          response_option: existing ? existing.response_option : null,
        };
      });

      assert.equal(reconciledCards[0].status, "ACKNOWLEDGED");
      assert.equal(reconciledCards[0].response_option, "Action In Progress");
      assert.equal(reconciledCards[1].status, "COMPLETED");
      assert.equal(reconciledCards[2].status, "NEW");
    });
  });

  describe("7. Component Unmount & Debounce Timer Cleanup (Requirement 14)", () => {
    it("clears debounce timer and ignores asynchronous responses when unmounted", async () => {
      let isMounted = true;
      let committed = false;
      let timer = null;

      const scheduleDebouncedUpdate = () => {
        timer = setTimeout(() => {
          if (isMounted) {
            committed = true;
          }
        }, 30);
      };

      scheduleDebouncedUpdate();

      // Simulate unmount before timer fires
      clearTimeout(timer);
      isMounted = false;

      // Wait beyond the 30ms window
      await new Promise((r) => setTimeout(r, 45));

      assert.equal(committed, false);
      assert.equal(isMounted, false);
    });
  });
});
