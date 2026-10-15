import json
import pytest
from pathlib import Path
from tempfile import TemporaryDirectory
from backend.schemas.action_queue import ActionStatus, ActionItem
from backend.services.action_queue_service import EDActionQueueService
from backend.schemas.orchestrator import (
    OrchestratorResponse,
    RecommendationAction,
    WorkloadAssessment,
    ExplanationDetail,
    WorkloadFactor,
)
from backend.schemas.hospital_state import HospitalState


def _make_dummy_orchestrator_response(priority: str = "HIGH", priority_score: float = 78.0) -> OrchestratorResponse:
    return OrchestratorResponse(
        overall_pressure_score=75.0,
        pressure_level="HIGH",
        workload_assessment=WorkloadAssessment(
            doctor_load_ratio=4.5,
            nurse_load_ratio=5.2,
            bed_occupancy_percent=82.0,
            current_workload_level="HIGH",
            upcoming_3h_workload_level="HIGH",
            summary="High workload detected",
        ),
        prioritized_issues=[],
        recommended_actions=[
            RecommendationAction(
                id="rec-bed-transfer",
                category="BED CAPACITY",
                priority=priority,
                severity=priority,
                title="Initiate Inpatient Bed Transfers",
                description="High bed occupancy requires rapid transfers.",
                recommended_action="Coordinate with hospital bed command to expedite pending admissions.",
                recommended_actions=[
                    "Coordinate with hospital bed command to expedite pending admissions.",
                    "Prepare surge flex beds in observation unit."
                ],
                contributing_metrics={"occupancy_percent": 82.0, "available_beds": 4},
                urgency="WITHIN 30 MIN",
                due_in_minutes=25,
                contributing_factors=[
                    WorkloadFactor(name="Occupancy", impact="increases_pressure", contribution_score=82.0, detail="82% occupied")
                ],
                reason="High bed occupancy reduces turnover.",
                rule_id="RULE_BED_CAPACITY_STRAIN",
                priority_score=priority_score,
                model_confidence=0.89,
                issue_trend="ESCALATING" if priority == "CRITICAL" else "NEW",
                escalation_detected=(priority == "CRITICAL"),
                confidence="HIGH",
                explanation_detail=ExplanationDetail(
                    detection_rationale="Occupancy exceeds safety threshold",
                    contributing_factors=[],
                    strongest_influencer="Occupancy",
                    triggering_prediction="Crowding classifier",
                    expected_operational_condition="Treatment bay boarding",
                    staff_review_guidance="Expedite pending floor transfers",
                ),
            ),
            RecommendationAction(
                id="rec-triage-staffing",
                category="TRIAGE CAPACITY",
                priority="MODERATE",
                severity="MODERATE",
                title="Augment Triage Screening",
                description="Triage queue is accumulating.",
                recommended_action="Deploy auxiliary triage intake nurse.",
                recommended_actions=["Deploy auxiliary triage intake nurse."],
                contributing_metrics={"patients_waiting": 18},
                urgency="WITHIN 1 HOUR",
                due_in_minutes=45,
                contributing_factors=[],
                reason="Queue length approaching bottleneck threshold.",
                rule_id="RULE_TRIAGE_INTAKE",
                priority_score=60.0,
                confidence="HIGH",
                explanation_detail=ExplanationDetail(
                    detection_rationale="Triage queue is accumulating",
                    contributing_factors=[],
                    strongest_influencer="Patients Waiting",
                    triggering_prediction="Wait time regressor",
                    expected_operational_condition="Queue delay",
                    staff_review_guidance="Assign float nurse to triage",
                ),
            )
        ],
        ml_engine_status={"forecast": "online", "waiting_time": "online"},
        degraded_mode=False,
        data_sources_used=["Observed HospitalState Telemetry"],
        timestamp="2026-10-14T20:00:00Z",
    )


def test_persistent_storage_and_reload():
    """Verify that action status and acknowledgement metadata persist to disk and reload accurately."""
    with TemporaryDirectory() as tmp_dir:
        dir_path = Path(tmp_dir)
        service = EDActionQueueService(data_dir=dir_path)

        # Sync initial recommendations
        orch_res = _make_dummy_orchestrator_response(priority="HIGH")
        service.sync_with_orchestrator(orch_res)

        # Confirm initial state is NEW
        queue = service.get_action_queue(filter_status="ALL")
        assert len(queue.actions) == 2
        bed_action = next(a for a in queue.actions if a.id == "rec-bed-transfer")
        assert bed_action.status == ActionStatus.NEW

        # Acknowledge the recommendation
        notes_text = "Contacted 4th floor bed manager. 3 beds opening in 20 mins."
        ack_time = "2026-10-14T20:05:00Z"
        updated = service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action In Progress",
            notes=notes_text,
            acknowledged_at=ack_time,
        )

        assert updated.status == ActionStatus.ACKNOWLEDGED
        assert updated.response_option == "Action In Progress"
        assert updated.notes == notes_text
        assert updated.acknowledged_at == ack_time
        assert len(updated.audit_history) >= 2  # Detection + Acknowledged

        # Initialize fresh service instance on the same directory (simulating server restart / refresh)
        service_reloaded = EDActionQueueService(data_dir=dir_path)
        reloaded_queue = service_reloaded.get_action_queue(filter_status="ALL")
        reloaded_bed_action = next(a for a in reloaded_queue.actions if a.id == "rec-bed-transfer")

        assert reloaded_bed_action.status == ActionStatus.ACKNOWLEDGED
        assert reloaded_bed_action.response_option == "Action In Progress"
        assert reloaded_bed_action.notes == notes_text
        assert reloaded_bed_action.acknowledged_at == ack_time


def test_repeated_submissions_and_updates():
    """Verify that repeated acknowledgement submissions update notes/status safely without corruption."""
    with TemporaryDirectory() as tmp_dir:
        service = EDActionQueueService(data_dir=Path(tmp_dir))
        service.sync_with_orchestrator(_make_dummy_orchestrator_response())

        # First submission
        service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action Planned",
            notes="Initial plan: check floor 3.",
            acknowledged_at="2026-10-14T20:01:00Z",
        )

        # Repeated submission updating the plan to In Progress
        updated2 = service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action In Progress",
            notes="Updated note: Transfer crew actively moving patients.",
            acknowledged_at="2026-10-14T20:08:00Z",
        )

        assert updated2.status == ActionStatus.ACKNOWLEDGED
        assert updated2.response_option == "Action In Progress"
        assert "Transfer crew actively moving patients" in updated2.notes
        # Both acknowledgement events exist in audit trail
        ack_events = [e for e in updated2.audit_history if e["event"] == "ACTION_ACKNOWLEDGED"]
        assert len(ack_events) == 2


def test_underlying_issue_change_preserves_history():
    """
    Verify that if the underlying issue changes (e.g. severity escalates),
    the recommendation's acknowledged status is preserved, condition_changed_since_ack is set,
    and the change is recorded in audit_history.
    """
    with TemporaryDirectory() as tmp_dir:
        service = EDActionQueueService(data_dir=Path(tmp_dir))
        
        # 1. Initial state at HIGH severity
        orch_res_high = _make_dummy_orchestrator_response(priority="HIGH")
        service.sync_with_orchestrator(orch_res_high)

        # 2. Staff acknowledges the issue
        service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action Planned",
            notes="Monitoring bed occupancy.",
            acknowledged_at="2026-10-14T20:00:00Z",
        )

        # 3. Operations worsen: severity escalates to CRITICAL
        orch_res_crit = _make_dummy_orchestrator_response(priority="CRITICAL", priority_score=94.0)
        service.sync_with_orchestrator(orch_res_crit)

        item = service._actions["rec-bed-transfer"]

        # Status must NOT be silently reset to NEW!
        assert item.status == ActionStatus.ACKNOWLEDGED
        assert item.response_option == "Action Planned"
        assert item.notes == "Monitoring bed occupancy."
        # Severity reflects current ML model output
        assert item.priority == "CRITICAL"
        assert item.priority_score == 94.0
        # Flag and audit trail indicate the change occurred after acknowledgement
        assert item.condition_changed_since_ack is True
        assert "Operational severity updated from HIGH to CRITICAL" in item.condition_change_summary
        
        change_events = [e for e in item.audit_history if e["event"] == "UNDERLYING_CONDITION_CHANGED"]
        assert len(change_events) >= 1
        assert change_events[-1]["previous_priority"] == "HIGH"
        assert change_events[-1]["new_priority"] == "CRITICAL"


def test_auditable_resolution_workflow():
    """Verify that an issue can be marked resolved through an explicit workflow."""
    with TemporaryDirectory() as tmp_dir:
        service = EDActionQueueService(data_dir=Path(tmp_dir))
        service.sync_with_orchestrator(_make_dummy_orchestrator_response())

        # Acknowledge first
        service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action In Progress",
            notes="Transfers underway.",
        )

        # Mark Resolved
        res_time = "2026-10-14T20:30:00Z"
        res_notes = "Bed transfer completed. 4 inpatient beds opened and treatment bays cleared."
        resolved_item = service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.COMPLETED,
            resolved_at=res_time,
            resolution_notes=res_notes,
            resolved_by="ChargeNurse_Smith",
        )

        assert resolved_item.status == ActionStatus.COMPLETED
        assert resolved_item.resolved_at == res_time
        assert resolved_item.resolution_notes == res_notes
        assert resolved_item.resolved_by == "ChargeNurse_Smith"

        resolve_events = [e for e in resolved_item.audit_history if e["event"] == "ACTION_RESOLVED"]
        assert len(resolve_events) == 1
        assert resolve_events[0]["resolution_notes"] == res_notes


def test_independent_recommendation_tracking():
    """Verify that acknowledging or resolving one recommendation does not impact others."""
    with TemporaryDirectory() as tmp_dir:
        service = EDActionQueueService(data_dir=Path(tmp_dir))
        service.sync_with_orchestrator(_make_dummy_orchestrator_response())

        # Acknowledge rec-bed-transfer only
        service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.ACKNOWLEDGED,
            response_option="Action Planned",
            notes="Checking beds.",
        )

        bed_item = service._actions["rec-bed-transfer"]
        triage_item = service._actions["rec-triage-staffing"]

        assert bed_item.status == ActionStatus.ACKNOWLEDGED
        assert triage_item.status == ActionStatus.NEW  # Triage remains unaffected


def test_ml_severity_separation():
    """
    Verify that user workflow status (ACKNOWLEDGED / COMPLETED) is strictly separated
    from ML severity and prediction scores.
    """
    with TemporaryDirectory() as tmp_dir:
        service = EDActionQueueService(data_dir=Path(tmp_dir))
        service.sync_with_orchestrator(_make_dummy_orchestrator_response(priority="HIGH", priority_score=78.0))

        item_before = service._actions["rec-bed-transfer"]
        assert item_before.priority == "HIGH"
        assert item_before.priority_score == 78.0

        # Mark resolved
        service.update_action_status(
            action_id="rec-bed-transfer",
            new_status=ActionStatus.COMPLETED,
            resolution_notes="Resolved by clinical team.",
        )

        item_after = service._actions["rec-bed-transfer"]
        # Workflow status is COMPLETED, but ML severity remains HIGH (unaltered)
        assert item_after.status == ActionStatus.COMPLETED
        assert item_after.priority == "HIGH"
        assert item_after.priority_score == 78.0
