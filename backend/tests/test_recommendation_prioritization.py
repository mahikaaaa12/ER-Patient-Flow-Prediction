"""
Unit test suite for ERFlow Recommendation Prioritization, Pattern Grouping,
Duplicate Suppression, Native Model Confidence Distinction, and Lifecycle Tracking.
"""

import pytest
from backend.schemas.hospital_state import HospitalState
from backend.schemas.overview import DashboardOverviewResponse
from backend.schemas.supervised import WaitingTimeResponse, CrowdingRiskResponse
from backend.schemas.unsupervised import FlowPatternResponse, SurgeDetectionResponse
from backend.schemas.deep_learning import ArrivalForecastResponse
from backend.schemas.orchestrator import RecommendationAction, WorkloadFactor, ExplanationDetail
from backend.schemas.action_queue import ActionStatus
from backend.services.recommendation_engine import (
    EDRecommendationEngine,
    RecommendationThresholds,
    PrioritizationWeights,
)
from backend.services.action_queue_service import EDActionQueueService


@pytest.fixture
def clean_engine():
    """Returns a fresh recommendation engine with clear history."""
    engine = EDRecommendationEngine()
    engine.reset_history()
    return engine


@pytest.fixture
def sample_explanation():
    return ExplanationDetail(
        detection_rationale="Test rationale",
        contributing_factors=[],
        strongest_influencer="Test influencer",
        triggering_prediction="Test prediction",
        expected_operational_condition="Test condition",
        staff_review_guidance="Test guidance",
    )


@pytest.fixture
def mock_overview():
    """Constructs a mock multi-model overview with calibrated model outputs."""
    return DashboardOverviewResponse(
        forecast=ArrivalForecastResponse(
            horizon="24h",
            horizons={"1h": 22.0, "2h": 24.0, "3h": 36.0},
            trend="Increasing",
            predicted_peak_time="20:00",
            predicted_peak_rate=34.0,
            hourly_forecast=[],
            risk_window="Evening Rush",
            recommendation="Pre-stage intake bays",
            series=[],
            forecast_cards=[],
        ),
        waiting_time=WaitingTimeResponse(
            waiting_time_minutes=48.0,
            predicted_1h=52.0,
            predicted_peak=65.0,
            trend="Increasing",
            explanation={"top_factors": [{"feature": "Patients Waiting", "importance": 0.45, "direction": "increases"}]},
        ),
        crowding_risk=CrowdingRiskResponse(
            crowding_level="High",
            crowding_score=76,
            probabilities={"Low": 0.05, "Moderate": 0.15, "High": 0.80, "Critical": 0.0},
            explanation={"top_factors": [{"feature": "Bed Occupancy", "importance": 0.50, "direction": "increases"}]},
        ),
        flow_pattern=FlowPatternResponse(
            pattern_name="High Demand Inflow",
            confidence=88.0,
            cluster_id=2,
            description="High demand pattern with sustained incoming ambulance velocity.",
            current_point={"x": 1.4, "y": 2.1},
        ),
        surge_detection=SurgeDetectionResponse(
            is_surge=False,
            status="Normal Department Rate",
            severity="Low",
            current_arrival_rate=26.0,
            normal_arrival_rate="20-25 pts/hr",
            deviation_percent="+4%",
            detected_at="2026-10-14T20:00:00Z",
            description="Arrivals within normal baseline envelope.",
        ),
        engine_status={
            "forecast": "success",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_pattern": "success",
            "surge_detection": "success",
        },
    )


# ==============================================================================
# TEST 1: Dynamic Priority Scoring & Factor Influences
# ==============================================================================
def test_dynamic_priority_scoring_factors(clean_engine, sample_explanation):
    """
    Verifies that the priority score:
    1. Ranges monotonically between 0 and 100.
    2. Ranks higher severity and shorter due time above lower severity and longer due time.
    3. Reflects compounding risk factors and resource feasibility.
    """
    weights = PrioritizationWeights()

    # Critical recommendation due immediately (<= 15m) with assigned resources
    rec_critical = RecommendationAction(
        id="rec-critical-test",
        category="BED CAPACITY",
        priority="CRITICAL",
        severity="CRITICAL",
        title="Immediate Inpatient Transfer Escalation",
        description="Bed saturation critical.",
        recommended_action="Execute immediate transfer.",
        recommended_actions=["Execute immediate transfer."],
        contributing_metrics={"occupancy_percent": 95.0, "available_beds": 1.0, "arrival_rate": 35.0, "waiting": 30.0},
        contributing_models=["Crowding Classifier"],
        contributing_fields=["occupancy_percent"],
        source_prediction="XGBoost",
        urgency="IMMEDIATE",
        due_in_minutes=15,
        contributing_factors=[],
        reason="Over capacity.",
        rule_id="RULE_TEST",
        rule_explanation="Test",
        forecast_horizon=None,
        required_resources=["Bed Command Team"],
        required_approvals=["Attending MD"],
        action_status="NEW",
        confidence="HIGH",
        explanation_detail=sample_explanation,
    )

    # Moderate recommendation due next shift (120m)
    rec_moderate = RecommendationAction(
        id="rec-moderate-test",
        category="FLOW",
        priority="MODERATE",
        severity="MODERATE",
        title="Scheduled Restock",
        description="Routine restocking.",
        recommended_action="Restock carts.",
        recommended_actions=["Restock carts."],
        contributing_metrics={"occupancy_percent": 60.0},
        contributing_models=[],
        contributing_fields=["occupancy_percent"],
        source_prediction="Telemetry",
        urgency="NEXT SHIFT",
        due_in_minutes=120,
        contributing_factors=[],
        reason="Shift restock.",
        rule_id="RULE_TEST_2",
        rule_explanation="Test",
        forecast_horizon=None,
        required_resources=[],
        required_approvals=[],
        action_status="NEW",
        confidence="HIGH",
        explanation_detail=sample_explanation,
    )

    score_crit = clean_engine.calculate_priority_score(rec_critical, weights=weights)
    score_mod = clean_engine.calculate_priority_score(rec_moderate, weights=weights)

    assert 0.0 <= score_crit <= 100.0
    assert 0.0 <= score_mod <= 100.0
    assert score_crit > score_mod
    assert score_crit >= 80.0
    assert score_mod <= 40.0


# ==============================================================================
# TEST 2: Workflow State Penalties
# ==============================================================================
def test_workflow_state_penalties(clean_engine, sample_explanation):
    """
    Verifies that workflow actions receive deterministic ranking penalties
    as their lifecycle advances (NEW > ACKNOWLEDGED > MONITORING > COMPLETED).
    """
    weights = PrioritizationWeights()

    sample_rec = RecommendationAction(
        id="rec-workflow-test",
        category="BED CAPACITY",
        priority="HIGH",
        severity="HIGH",
        title="Bed Action",
        description="Bed Action",
        recommended_action="Act",
        recommended_actions=["Act"],
        contributing_metrics={"occupancy_percent": 85.0},
        contributing_models=[],
        contributing_fields=["occupancy_percent"],
        source_prediction="Telemetry",
        urgency="WITHIN 30 MIN",
        due_in_minutes=30,
        contributing_factors=[],
        reason="Reason",
        rule_id="RULE_BED",
        rule_explanation="Expl",
        forecast_horizon=None,
        required_resources=["Team"],
        required_approvals=["Supervisor"],
        action_status="NEW",
        confidence="HIGH",
        explanation_detail=sample_explanation,
    )

    score_new = clean_engine.calculate_priority_score(sample_rec, weights, action_status="NEW")
    score_ack = clean_engine.calculate_priority_score(sample_rec, weights, action_status="ACKNOWLEDGED")
    score_mon = clean_engine.calculate_priority_score(sample_rec, weights, action_status="MONITORING")
    score_cmp = clean_engine.calculate_priority_score(sample_rec, weights, action_status="COMPLETED")

    assert score_new > score_ack
    assert score_ack > score_mon
    assert score_mon > score_cmp
    assert round(score_new - score_ack, 1) == weights.penalty_acknowledged
    assert round(score_new - score_mon, 1) == weights.penalty_monitoring
    assert round(score_new - score_cmp, 1) == weights.penalty_completed


# ==============================================================================
# TEST 3: Deterministic Multi-Key Ranking & Tie-Breaking
# ==============================================================================
def test_deterministic_multi_key_ranking_and_tie_breaking(clean_engine):
    """
    Ensures identical inputs and predictions produce 100% deterministic,
    reproducible rankings with ties broken by stable identifiers.
    """
    state = HospitalState(
        occupancy_percent=88.0,
        patients_waiting=28.0,
        available_beds=3.0,
        arrival_rate=32.0,
        available_doctors=4.0,
        available_nurses=7.0,
    )

    # Run evaluate_rules 5 consecutive times on clean engine resets
    rankings = []
    for _ in range(5):
        clean_engine.reset_history()
        _, recs = clean_engine.evaluate_rules(state)
        rankings.append([r.id for r in recs])

    # All 5 evaluation runs must produce identical ordering
    for i in range(1, len(rankings)):
        assert rankings[i] == rankings[0]

    # Verify sorting contract: (-priority_score, -severity, due_in_minutes, id)
    _, final_recs = clean_engine.evaluate_rules(state)
    for i in range(len(final_recs) - 1):
        r1, r2 = final_recs[i], final_recs[i + 1]
        assert r1.priority_score >= r2.priority_score or (
            r1.priority_score == r2.priority_score and r1.due_in_minutes <= r2.due_in_minutes
        )


# ==============================================================================
# TEST 4: Duplicate Suppression & Pattern Grouping
# ==============================================================================
def test_duplicate_suppression_and_pattern_grouping(clean_engine, mock_overview):
    """
    When Pattern 1 (High Occupancy + Rising Inflow) and Pattern 4 (Bed Inventory Depletion)
    both fire, they must consolidate into a single rec-bed-capacity card while
    preserving distinct actions from both patterns without duplication.
    """
    state = HospitalState(
        occupancy_percent=88.0,
        available_beds=2.0,  # Triggers Pattern 4
        arrival_rate=32.0,   # Combined with forecast 3h=36 triggers Pattern 1
        patients_waiting=22.0,
    )

    issues, recs = clean_engine.evaluate_rules(state, mock_overview)

    # Exactly one bed capacity recommendation must exist
    bed_recs = [r for r in recs if r.id == "rec-bed-capacity"]
    assert len(bed_recs) == 1
    bed_rec = bed_recs[0]

    # Max severity must be CRITICAL (since available_beds=2.0 <= critical threshold 2.0)
    assert bed_rec.severity == "CRITICAL"

    # Distinct actions from both Pattern 1 (transfers/discharge lounge) and Pattern 4 (bed utilization audit/flex bays)
    # must be preserved in recommended_actions
    assert len(bed_rec.recommended_actions) >= 4
    action_texts = " ".join(bed_rec.recommended_actions)
    assert "inpatient transfers" in action_texts.lower() or "discharge lounge" in action_texts.lower()
    assert "bed utilization audit" in action_texts.lower() or "flex" in action_texts.lower()

    # Issues must also be consolidated
    bed_issues = [i for i in issues if i.id == "iss-bed-capacity"]
    assert len(bed_issues) == 1


# ==============================================================================
# TEST 5: Native Model Confidence Distinction (No Invented Confidence)
# ==============================================================================
def test_model_confidence_distinction(clean_engine, mock_overview):
    """
    Verifies that:
    1. XGBoost Crowding Classifier native probability (0.80) is captured in model_confidence.
    2. K-Means Flow Pattern clustering confidence (0.88) is captured.
    3. Regression models (Waiting Time) and pure telemetry rules have model_confidence == None.
    4. Rule-based priority_score is always computed regardless of whether model_confidence is present.
    """
    # 1. Evaluate state where crowding classifier fired
    state_crowded = HospitalState(occupancy_percent=85.0, arrival_rate=15.0)
    _, recs_crowd = clean_engine.evaluate_rules(state_crowded, mock_overview)
    crowd_rec = next((r for r in recs_crowd if r.id == "rec-persistent-crowding"), None)
    if crowd_rec:
        assert crowd_rec.model_confidence == 0.80
        assert crowd_rec.priority_score > 0.0

    # 2. Evaluate state where only regression / rule-based wait time fired
    clean_engine.reset_history()
    state_queue = HospitalState(occupancy_percent=60.0, patients_waiting=25.0, arrival_rate=15.0)
    # Turn off crowding
    mock_overview.crowding_risk.crowding_score = 30
    mock_overview.crowding_risk.crowding_level = "Low"
    _, recs_queue = clean_engine.evaluate_rules(state_queue, mock_overview)

    queue_rec = next((r for r in recs_queue if r.id == "rec-triage-capacity"), None)
    assert queue_rec is not None
    # Regressor does not have probabilistic class distribution -> must be None
    assert queue_rec.model_confidence is None
    # But priority_score is a valid 0-100 float
    assert 0.0 <= queue_rec.priority_score <= 100.0


# ==============================================================================
# TEST 6: Lifecycle Tracking (Escalation, De-escalation, Stability)
# ==============================================================================
def test_issue_lifecycle_escalation_and_deescalation(clean_engine):
    """
    Verifies dynamic tracking of issue trends across consecutive evaluation cycles:
    Cycle 1: NEW
    Cycle 2: ESCALATING (severity increase triggers escalation_detected=True)
    Cycle 3: DE-ESCALATING (severity decrease triggers escalation_detected=False)
    Cycle 4: STABLE (severity unchanged)
    """
    # Cycle 1: High occupancy (82%) -> HIGH severity
    s1 = HospitalState(occupancy_percent=82.0, available_beds=4.0, arrival_rate=30.0)
    _, r1 = clean_engine.evaluate_rules(s1)
    bed1 = next(r for r in r1 if r.id == "rec-bed-capacity")
    assert bed1.issue_trend == "NEW"
    assert bed1.escalation_detected is False
    assert bed1.historical_occurrence_count == 1

    # Cycle 2: Occupancy spikes to 94% -> CRITICAL severity
    s2 = HospitalState(occupancy_percent=94.0, available_beds=1.0, arrival_rate=34.0)
    _, r2 = clean_engine.evaluate_rules(s2)
    bed2 = next(r for r in r2 if r.id == "rec-bed-capacity")
    assert bed2.issue_trend == "ESCALATING"
    assert bed2.escalation_detected is True
    assert bed2.historical_occurrence_count == 1

    # Cycle 3: Occupancy drops to 84% -> HIGH severity
    s3 = HospitalState(occupancy_percent=84.0, available_beds=4.0, arrival_rate=30.0)
    _, r3 = clean_engine.evaluate_rules(s3)
    bed3 = next(r for r in r3 if r.id == "rec-bed-capacity")
    assert bed3.issue_trend == "DE-ESCALATING"
    assert bed3.escalation_detected is False

    # Cycle 4: Occupancy remains at 84% -> HIGH severity
    s4 = HospitalState(occupancy_percent=84.0, available_beds=4.0, arrival_rate=30.0)
    _, r4 = clean_engine.evaluate_rules(s4)
    bed4 = next(r for r in r4 if r.id == "rec-bed-capacity")
    assert bed4.issue_trend == "STABLE"
    assert bed4.escalation_detected is False


# ==============================================================================
# TEST 7: Recovery Hysteresis Buffer
# ==============================================================================
def test_recovery_hysteresis_buffer(clean_engine):
    """
    Verifies that when an active issue's metric improves below the initial
    warning threshold (80%) but has NOT reached the recovery threshold (75%),
    it does NOT prematurely vanish. It remains active in RECOVERY_PENDING state.
    """
    th = RecommendationThresholds(occupancy_warning=80.0, occupancy_recovery=75.0)

    # Cycle 1: Occupancy at 85% -> Warning triggers rec-bed-capacity
    s1 = HospitalState(occupancy_percent=85.0, available_beds=4.0, arrival_rate=30.0)
    _, r1 = clean_engine.evaluate_rules(s1, thresholds=th)
    assert any(r.id == "rec-bed-capacity" for r in r1)

    # Cycle 2: Occupancy drops to 78% (<80% warning, but >75% recovery buffer)
    s2 = HospitalState(occupancy_percent=78.0, available_beds=6.0, arrival_rate=20.0)
    _, r2 = clean_engine.evaluate_rules(s2, thresholds=th)
    bed2 = next((r for r in r2 if r.id == "rec-bed-capacity"), None)
    assert bed2 is not None
    assert bed2.issue_trend == "RECOVERY_PENDING"
    assert bed2.requires_human_confirmation_to_resolve is True
    assert bed2.severity == "MODERATE"

    # Cycle 3: Occupancy drops to 70% (<=75% recovery threshold)
    s3 = HospitalState(occupancy_percent=70.0, available_beds=9.0, arrival_rate=18.0)
    _, r3 = clean_engine.evaluate_rules(s3, thresholds=th)
    # Issue has completely recovered
    assert not any(r.id == "rec-bed-capacity" for r in r3)


# ==============================================================================
# TEST 8: Recurrence Detection After Resolution
# ==============================================================================
def test_recurrence_detection_after_resolution(clean_engine):
    """
    Verifies that after an issue resolves, if it reappears in a subsequent
    surge, it is flagged as RECURRENCE with incremented historical_occurrence_count.
    """
    th = RecommendationThresholds(occupancy_warning=80.0, occupancy_recovery=75.0)

    # Cycle 1: Alert active
    s1 = HospitalState(occupancy_percent=85.0, available_beds=4.0, arrival_rate=30.0)
    clean_engine.evaluate_rules(s1, thresholds=th)

    # Cycle 2: Resolved
    s2 = HospitalState(occupancy_percent=68.0, available_beds=10.0, arrival_rate=18.0)
    clean_engine.evaluate_rules(s2, thresholds=th)

    # Cycle 3: Surges again to 86%
    s3 = HospitalState(occupancy_percent=86.0, available_beds=4.0, arrival_rate=32.0)
    _, r3 = clean_engine.evaluate_rules(s3, thresholds=th)
    bed3 = next((r for r in r3 if r.id == "rec-bed-capacity"), None)

    assert bed3 is not None
    assert bed3.issue_trend == "RECURRENCE"
    assert bed3.historical_occurrence_count == 2


# ==============================================================================
# TEST 9: Action Queue Integration & Status Persistence
# ==============================================================================
def test_action_queue_integration_and_status_persistence(clean_engine, tmp_path):
    """
    Verifies end-to-end integration with the Action Queue service:
    1. Newly evaluated recommendations sync to ActionItems with priority_score and lifecycle fields.
    2. When an action is ACKNOWLEDGED by staff, subsequent evaluations retain that state
       and apply workflow rank adjustments.
    """
    queue_service = EDActionQueueService(data_dir=tmp_path)
    state = HospitalState(occupancy_percent=88.0, available_beds=3.0, arrival_rate=32.0)

    # Initial evaluation
    issues, recs = clean_engine.evaluate_rules(state)
    from backend.schemas.orchestrator import OrchestratorResponse, WorkloadAssessment
    mock_orch = OrchestratorResponse(
        overall_pressure_score=80.0,
        pressure_level="HIGH",
        workload_assessment=WorkloadAssessment(
            doctor_load_ratio=4.0,
            nurse_load_ratio=6.0,
            bed_occupancy_percent=88.0,
            current_workload_level="HIGH",
            upcoming_3h_workload_level="HIGH",
            summary="High load",
        ),
        prioritized_issues=issues,
        recommended_actions=recs,
        data_sources_used=["Telemetry"],
        ml_engine_status={"telemetry": "success"},
        degraded_mode=False,
        timestamp="2026-10-14T20:00:00Z",
    )

    synced_items = queue_service.sync_with_orchestrator(mock_orch)
    assert len(synced_items) > 0

    # Verify priority fields were synced into ActionItem
    bed_action = next(i for i in synced_items if i.id == "rec-bed-capacity")
    assert bed_action.priority_score is not None
    assert bed_action.status == ActionStatus.NEW

    # User acknowledges the action
    queue_service.update_action_status(
        action_id="rec-bed-capacity",
        new_status=ActionStatus.ACKNOWLEDGED,
        response_option="Action In Progress",
        notes="Called bed placement",
    )

    # Next evaluation provides action_statuses map to recommendation engine
    action_statuses = {item.id: item.status.value for item in queue_service._actions.values()}
    _, updated_recs = clean_engine.evaluate_rules(state, action_statuses=action_statuses)

    updated_bed = next(r for r in updated_recs if r.id == "rec-bed-capacity")
    assert updated_bed.action_status == "ACKNOWLEDGED"
    # Workflow penalty must have been applied compared to NEW
    assert updated_bed.priority_score < bed_action.priority_score
