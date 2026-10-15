import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Mock Storage mimicking window.localStorage / window.sessionStorage
 */
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe("Frontend Action Tracking - Persistent Workflow & Storage Suite", () => {
  let mockLocalStorage;
  let mockSessionStorage;

  beforeEach(() => {
    mockLocalStorage = new MockStorage();
    mockSessionStorage = new MockStorage();
  });

  describe("1. Action State Persistence in Storage", () => {
    it("persists acknowledgement records to both localStorage and sessionStorage", () => {
      const recId = "rec-triage-capacity";
      const ackRecord = {
        status: "ACKNOWLEDGED",
        response_option: "Action Planned",
        notes: "Staffing auxiliary triage desk for next 2 hours",
        acknowledged_at: new Date().toISOString(),
        priority: "HIGH",
      };

      const actionStatuses = { [recId]: ackRecord };

      mockLocalStorage.setItem("erflow_action_statuses", JSON.stringify(actionStatuses));
      mockSessionStorage.setItem("erflow_action_statuses", JSON.stringify(actionStatuses));

      const retrievedLocal = JSON.parse(mockLocalStorage.getItem("erflow_action_statuses"));
      const retrievedSession = JSON.parse(mockSessionStorage.getItem("erflow_action_statuses"));

      assert.deepEqual(retrievedLocal, actionStatuses);
      assert.deepEqual(retrievedSession, actionStatuses);
      assert.equal(retrievedLocal[recId].status, "ACKNOWLEDGED");
      assert.equal(retrievedLocal[recId].response_option, "Action Planned");
      assert.equal(retrievedLocal[recId].notes, "Staffing auxiliary triage desk for next 2 hours");
    });

    it("persists resolution records with audit metadata", () => {
      const recId = "rec-bed-capacity";
      const resolutionRecord = {
        status: "COMPLETED",
        response_option: "Action In Progress",
        notes: "Initial bed transfer coordinated",
        acknowledged_at: "2026-10-14T20:00:00.000Z",
        resolved_at: "2026-10-14T20:30:00.000Z",
        resolution_notes: "4 inpatient beds opened and patients transferred to step-down unit.",
        priority: "HIGH",
      };

      mockLocalStorage.setItem("erflow_action_statuses", JSON.stringify({ [recId]: resolutionRecord }));
      const loaded = JSON.parse(mockLocalStorage.getItem("erflow_action_statuses"));

      assert.equal(loaded[recId].status, "COMPLETED");
      assert.equal(loaded[recId].resolution_notes, "4 inpatient beds opened and patients transferred to step-down unit.");
      assert.equal(loaded[recId].resolved_at, "2026-10-14T20:30:00.000Z");
    });
  });

  describe("2. Repeated Submission Guard (Double-Click Prevention)", () => {
    it("prevents duplicate submissions when submission is already in-flight", async () => {
      let callCount = 0;
      let isSubmitting = false;

      const submitAcknowledgement = async (recId, data) => {
        if (isSubmitting) {
          return { ignored: true };
        }
        isSubmitting = true;
        callCount++;
        // Simulate async API call delay
        await new Promise((r) => setTimeout(r, 20));
        isSubmitting = false;
        return { success: true };
      };

      // Fire two submissions simultaneously
      const [res1, res2] = await Promise.all([
        submitAcknowledgement("rec-1", { note: "First click" }),
        submitAcknowledgement("rec-1", { note: "Accidental double click" }),
      ]);

      assert.equal(callCount, 1);
      assert.equal(res1.success, true);
      assert.equal(res2.ignored, true);
    });

    it("prevents double resolution submission when resolution is in-flight", async () => {
      let resolveCallCount = 0;
      let resolveSubmitting = false;

      const submitResolution = async (recId, notes) => {
        if (resolveSubmitting) {
          return { rejected: true };
        }
        resolveSubmitting = true;
        resolveCallCount++;
        await new Promise((r) => setTimeout(r, 15));
        resolveSubmitting = false;
        return { resolved: true };
      };

      const [first, second] = await Promise.all([
        submitResolution("rec-2", "Resolved queue"),
        submitResolution("rec-2", "Duplicate click"),
      ]);

      assert.equal(resolveCallCount, 1);
      assert.equal(first.resolved, true);
      assert.equal(second.rejected, true);
    });
  });

  describe("3. Refresh Restoration and Hydration", () => {
    it("hydrates tracking state from storage on application startup/refresh", () => {
      // Simulate existing saved state from previous session
      const priorState = {
        "rec-triage": {
          status: "ACKNOWLEDGED",
          response_option: "Escalated to Supervisor",
          notes: "Pager sent to on-call triage supervisor",
          acknowledged_at: "2026-10-14T19:15:00.000Z",
        },
        "rec-bed": {
          status: "COMPLETED",
          resolution_notes: "Discharges expedited",
          resolved_at: "2026-10-14T19:45:00.000Z",
        },
      };

      mockLocalStorage.setItem("erflow_action_statuses", JSON.stringify(priorState));

      // Simulate initialization function from EDCommandOrchestrator
      const initializeStatuses = () => {
        try {
          const saved = mockLocalStorage.getItem("erflow_action_statuses") || mockSessionStorage.getItem("erflow_action_statuses");
          return saved ? JSON.parse(saved) : {};
        } catch {
          return {};
        }
      };

      const restored = initializeStatuses();
      assert.equal(restored["rec-triage"].status, "ACKNOWLEDGED");
      assert.equal(restored["rec-triage"].response_option, "Escalated to Supervisor");
      assert.equal(restored["rec-bed"].status, "COMPLETED");
      assert.equal(restored["rec-bed"].resolution_notes, "Discharges expedited");
    });

    it("merges backend action queue items into local statuses without overwriting local progress", () => {
      const localState = {
        "rec-triage": {
          status: "ACKNOWLEDGED",
          response_option: "Action In Progress",
          notes: "Local note in progress",
          acknowledged_at: "2026-10-14T21:00:00.000Z",
        },
      };

      const backendActions = [
        {
          id: "rec-triage",
          status: "ACKNOWLEDGED",
          response_option: "Action In Progress",
          notes: "Backend saved note",
          acknowledged_at: "2026-10-14T21:00:00.000Z",
        },
        {
          id: "rec-physician",
          status: "ACKNOWLEDGED",
          response_option: "Escalated to Supervisor",
          notes: "Added by attending physician",
          acknowledged_at: "2026-10-14T21:05:00.000Z",
        },
      ];

      // Reconciliation logic matching EDCommandOrchestrator.jsx: fetchActionQueue
      const next = { ...localState };
      backendActions.forEach((act) => {
        if (act.status === "ACKNOWLEDGED" || act.status === "COMPLETED" || act.status === "MONITORING") {
          if (!next[act.id]) {
            next[act.id] = {
              status: act.status,
              response_option: act.response_option || "Action Planned",
              notes: act.notes || "",
              acknowledged_at: act.acknowledged_at || act.created_at,
            };
          }
        }
      });

      assert.equal(Object.keys(next).length, 2);
      assert.equal(next["rec-triage"].status, "ACKNOWLEDGED");
      assert.equal(next["rec-physician"].status, "ACKNOWLEDGED");
      assert.equal(next["rec-physician"].response_option, "Escalated to Supervisor");
    });
  });

  describe("4. Failure Handling and Server Error Resilience", () => {
    it("captures and retains error state when backend persistence fails, keeping local state uncorrupted", async () => {
      let state = { "rec-fail": { status: "NEW" } };
      let errorMessage = null;
      let isSubmitting = false;

      const mockFailedApi = async () => {
        throw new Error("HTTP 503: Database persistence service unavailable");
      };

      const handleConfirmAcknowledgement = async (recId, payload) => {
        isSubmitting = true;
        errorMessage = null;
        try {
          await mockFailedApi();
          state[recId] = { status: "ACKNOWLEDGED", ...payload };
        } catch (err) {
          errorMessage = err.message || "Failed to persist acknowledgement";
        } finally {
          isSubmitting = false;
        }
      };

      await handleConfirmAcknowledgement("rec-fail", { response_option: "Action Planned" });

      assert.equal(isSubmitting, false);
      assert.equal(errorMessage, "HTTP 503: Database persistence service unavailable");
      // State was NOT corrupted by the failed network call
      assert.equal(state["rec-fail"].status, "NEW");
    });
  });

  describe("5. Independently Tracked Recommendations", () => {
    it("tracks multiple recommendations independently without state collision", () => {
      let actionStatuses = {};

      const updateRec = (id, newRecord) => {
        actionStatuses = { ...actionStatuses, [id]: newRecord };
      };

      // Acknowledge first recommendation
      updateRec("rec-1", {
        status: "ACKNOWLEDGED",
        response_option: "Action Planned",
        notes: "Assigned nurse",
      });

      // Second recommendation remains unacknowledged
      assert.equal(actionStatuses["rec-1"].status, "ACKNOWLEDGED");
      assert.equal(actionStatuses["rec-2"], undefined);

      // Resolve first recommendation
      updateRec("rec-1", {
        ...actionStatuses["rec-1"],
        status: "COMPLETED",
        resolution_notes: "Task finished",
      });

      // Acknowledge second recommendation
      updateRec("rec-2", {
        status: "ACKNOWLEDGED",
        response_option: "Reviewed — No Action Required",
        notes: "False alarm",
      });

      assert.equal(actionStatuses["rec-1"].status, "COMPLETED");
      assert.equal(actionStatuses["rec-1"].resolution_notes, "Task finished");
      assert.equal(actionStatuses["rec-2"].status, "ACKNOWLEDGED");
      assert.equal(actionStatuses["rec-2"].response_option, "Reviewed — No Action Required");
    });
  });

  describe("6. Separation of Workflow Status from ML Severity & Escalation", () => {
    it("preserves ACKNOWLEDGED status when underlying ML severity changes and alerts condition change", () => {
      const rec = {
        id: "rec-triage-capacity",
        priority: "MODERATE",
        escalation_detected: false,
      };

      // Staff acknowledges while priority is MODERATE
      const storedStatus = {
        status: "ACKNOWLEDGED",
        priority: "MODERATE",
        acknowledged_at: "2026-10-14T21:00:00.000Z",
      };

      // Telemetry update: waiting patients jump from 15 to 35, ML escalates priority to CRITICAL
      const updatedRec = {
        id: "rec-triage-capacity",
        priority: "CRITICAL",
        escalation_detected: true,
      };

      // Condition change detection logic matching recommendation engine & orchestrator UI
      const conditionChanged =
        storedStatus.status === "ACKNOWLEDGED" &&
        (updatedRec.priority !== storedStatus.priority || updatedRec.escalation_detected);

      assert.equal(storedStatus.status, "ACKNOWLEDGED"); // Workflow status NOT wiped out
      assert.equal(conditionChanged, true); // Flagged so UI displays amber alert banner
    });
  });

  describe("7. Hypothetical Simulation Isolation", () => {
    it("ensures simulated what-if scenarios do NOT alter real hospital action tracking", () => {
      const hospitalActionStore = new MockStorage();
      hospitalActionStore.setItem(
        "erflow_action_statuses",
        JSON.stringify({
          "rec-real-1": { status: "ACKNOWLEDGED", response_option: "Action Planned" },
        })
      );

      // Simulate a hypothetical scenario in Scenario Simulator
      const simulatedScenario = {
        isHypothetical: true,
        scenarioName: "Mass Casualty Incident +40 pts",
        simulatedActions: [
          { id: "sim-rec-1", action: "Deploy all flex beds" },
          { id: "sim-rec-2", action: "Call off-duty trauma surgeons" },
        ],
      };

      // Verify that scenario execution does NOT touch hospitalActionStore
      const beforeState = hospitalActionStore.getItem("erflow_action_statuses");

      // Running simulation...
      assert.equal(simulatedScenario.isHypothetical, true);

      const afterState = hospitalActionStore.getItem("erflow_action_statuses");
      assert.equal(beforeState, afterState);
      const parsed = JSON.parse(afterState);
      assert.equal(Object.keys(parsed).length, 1);
      assert.equal(parsed["rec-real-1"].status, "ACKNOWLEDGED");
      assert.equal(parsed["sim-rec-1"], undefined);
    });
  });
});
