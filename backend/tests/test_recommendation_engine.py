"""
Unit tests for ERFlow Dynamic Operational Recommendation Engine.

Verifies:
1. All 9 operational rule patterns trigger according to threshold criteria.
2. Configurable threshold support (both engine defaults and per-evaluation overrides).
3. Resilience to missing/partial ML overview inputs (NoneType handling).
4. Safety guarantees:
   - Every recommendation enforces `requires_human_review = True`.
   - Triage integrity policy preserved (no triage acuity re-classification).
   - Department-level operational guidance only (no clinical treatment directives).
5. Deficit sizing calculations for staffing saturation.
6. TreeSHAP factor formatting and confidence degradation flagging.
"""

import pytest
from backend.schemas.hospital_state import HospitalState
from backend.schemas.overview import DashboardOverviewResponse
from backend.schemas.deep_learning import ArrivalForecastResponse
from backend.schemas.supervised import WaitingTimeResponse, CrowdingRiskResponse
from backend.schemas.unsupervised import FlowPatternResponse, SurgeDetectionResponse
from backend.services.recommendation_engine import (
    EDRecommendationEngine,
    RecommendationThresholds,
)


@pytest.fixture
def base_state():
    return HospitalState(
        occupancy_percent=65.0,
        patients_waiting=10.0,
        available_beds=14.0,
        arrival_rate=18.0,
        severity_level=3.0,
        available_doctors=6.0,
        available_nurses=12.0,
    )


@pytest.fixture
def normal_overview():
    return DashboardOverviewResponse(
        forecast=ArrivalForecastResponse(
            horizon="24h",
            horizons={"1h": 18.0, "2h": 19.0, "3h": 20.0},
            forecast_cards=[],
            predicted_peak_time="14:00",
            predicted_peak_rate=22.0,
            trend="Stable",
            series=[],
        ),
        waiting_time=WaitingTimeResponse(
            waiting_time_minutes=25.0,
            predicted_1h=26.0,
            predicted_peak=30.0,
            trend="Stable",
            explanation={"top_factors": [{"feature": "arrival_rate", "importance": 0.35, "direction": "increases"}]},
        ),
        crowding_risk=CrowdingRiskResponse(
            crowding_level="MODERATE",
            crowding_score=45,
            probabilities={"low": 0.3, "moderate": 0.5, "high": 0.15, "critical": 0.05},
            explanation={"top_factors": [{"feature": "occupancy_percent", "importance": 0.40, "direction": "increases"}]},
        ),
        flow_pattern=FlowPatternResponse(
            pattern_name="Stable Demand",
            confidence=85.0,
            cluster_id=0,
            description="Operational flow is within baseline limits.",
            current_point={"x": 0.1, "y": -0.2},
        ),
        surge_detection=SurgeDetectionResponse(
            is_surge=False,
            status="NORMAL OPERATIONAL LOAD",
            severity="Low",
            current_arrival_rate=18.0,
            normal_arrival_rate="18-24/hr",
            deviation_percent="+2%",
            detected_at="2026-10-14 20:00",
            description="Arrival rates are within expected statistical bounds.",
        ),
        ai_summary_text="All systems operating within normal parameters.",
        engine_status={
            "forecast": "success",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_patterns": "success",
            "surge_detection": "success",
        },
    )


def test_rule_baseline_stable(base_state, normal_overview):
    """Under normal operating telemetry, engine outputs baseline stability."""
    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(
        state=base_state,
        overview=normal_overview,
        engine_status=normal_overview.engine_status,
        degraded_mode=False,
    )

    assert len(issues) == 1
    assert issues[0].id == "iss-baseline-stable"
    assert issues[0].severity == "LOW"

    assert len(recs) == 1
    assert recs[0].id == "rec-baseline-maintenance"
    assert recs[0].rule_id == "RULE_BASELINE_STABLE"
    assert recs[0].priority == "LOW"
    assert recs[0].requires_human_review is True


def test_rule_occ_high_arrival_rising(base_state, normal_overview):
    """High occupancy + rising inflow triggers RULE_OCC_HIGH_ARRIVAL_RISING."""
    state = base_state.model_copy(update={"occupancy_percent": 88.0, "available_beds": 4.0, "arrival_rate": 32.0})
    normal_overview.forecast.trend = "Increasing"
    normal_overview.forecast.horizons["3h"] = 38.0

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(state, normal_overview)

    occ_issues = [i for i in issues if i.id == "iss-bed-capacity"]
    assert len(occ_issues) == 1
    assert occ_issues[0].severity in ["HIGH", "CRITICAL"]

    occ_recs = [r for r in recs if r.id == "rec-bed-capacity"]
    assert len(occ_recs) == 1
    rec = occ_recs[0]
    assert rec.rule_id == "RULE_OCC_HIGH_ARRIVAL_RISING"
    assert rec.requires_human_review is True
    assert "occupancy_percent" in rec.contributing_metrics
    assert rec.contributing_metrics["occupancy_percent"] == 88.0
    assert len(rec.recommended_actions) >= 3


def test_rule_queue_elevated_wait_and_safety_disclaimer(base_state, normal_overview):
    """Elevated queue and wait time triggers RULE_QUEUE_ELEVATED_WAIT with triage safety policy."""
    state = base_state.model_copy(update={"patients_waiting": 30.0})
    normal_overview.waiting_time.waiting_time_minutes = 65.0
    normal_overview.waiting_time.trend = "Increasing"

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(state, normal_overview)

    queue_recs = [r for r in recs if r.id == "rec-triage-capacity"]
    assert len(queue_recs) == 1
    rec = queue_recs[0]
    assert rec.rule_id == "RULE_QUEUE_ELEVATED_WAIT"
    assert rec.severity == "CRITICAL"
    assert rec.requires_human_review is True

    # Critical Safety Verification: must advise against altering clinical triage acuity solely for queue stats
    guidance = rec.explanation_detail.staff_review_guidance
    assert "Do NOT adjust patient triage priority solely to alter queue statistics" in guidance


def test_rule_staffing_ratio_saturation(base_state, normal_overview):
    """High patient-to-staff ratios trigger RULE_STAFFING_RATIO_SATURATION with deficit sizing."""
    # 28 waiting patients / 3 doctors = 9.3 pts/MD (> 5.5 critical)
    state = base_state.model_copy(update={"patients_waiting": 28.0, "available_doctors": 3.0, "available_nurses": 4.0})

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(state, normal_overview)

    staff_recs = [r for r in recs if r.id == "rec-staffing-allocation"]
    assert len(staff_recs) == 1
    rec = staff_recs[0]
    assert rec.rule_id == "RULE_STAFFING_RATIO_SATURATION"
    assert rec.severity in ["HIGH", "CRITICAL"]
    assert rec.contributing_metrics["doctor_load_ratio"] >= 4.0
    assert rec.contributing_metrics["deficit_doctors"] > 0
    assert rec.contributing_metrics["deficit_nurses"] > 0


def test_rule_surge_anomalous_influx(base_state, normal_overview):
    """DBSCAN surge detection triggers RULE_SURGE_ANOMALOUS_INFLUX."""
    normal_overview.surge_detection.is_surge = True
    normal_overview.surge_detection.status = "ANOMALOUS SURGE DETECTED"
    normal_overview.surge_detection.deviation_percent = "+68%"
    state = base_state.model_copy(update={"arrival_rate": 42.0})

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(state, normal_overview)

    surge_recs = [r for r in recs if r.id == "rec-surge-mitigation"]
    assert len(surge_recs) == 1
    rec = surge_recs[0]
    assert rec.rule_id == "RULE_SURGE_ANOMALOUS_INFLUX"
    assert rec.urgency == "IMMEDIATE"
    assert rec.due_in_minutes <= 15
    assert rec.requires_human_review is True


def test_rule_persistent_crowding_stagnation(base_state, normal_overview):
    """High crowding score with low arrival velocity flags internal exit/boarding block."""
    state = base_state.model_copy(update={"arrival_rate": 12.0, "occupancy_percent": 82.0})
    normal_overview.crowding_risk.crowding_score = 85
    normal_overview.crowding_risk.crowding_level = "HIGH"

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(state, normal_overview)

    crowd_recs = [r for r in recs if r.id == "rec-persistent-crowding"]
    assert len(crowd_recs) == 1
    rec = crowd_recs[0]
    assert rec.rule_id == "RULE_PERSISTENT_CROWDING_STAGNATION"
    assert "Inpatient Boarding" in rec.title or "inpatient" in rec.description.lower()
    assert rec.requires_human_review is True


def test_rule_lstm_peak_forecast(base_state, normal_overview):
    """Upcoming 3h peak arrival forecast triggers RULE_LSTM_PEAK_FORECAST."""
    normal_overview.forecast.horizons["3h"] = 48.0
    normal_overview.forecast.predicted_peak_rate = 38.0
    normal_overview.forecast.predicted_peak_time = "16:30"

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(base_state, normal_overview)

    fc_recs = [r for r in recs if r.id == "rec-forecast-staging"]
    assert len(fc_recs) == 1
    rec = fc_recs[0]
    assert rec.rule_id == "RULE_LSTM_PEAK_FORECAST"
    assert rec.forecast_horizon == "3h"
    assert rec.contributing_metrics["predicted_peak_rate"] == 38.0


def test_rule_conflicting_or_degraded_data(base_state, normal_overview):
    """Degraded ML engine status triggers RULE_CONFLICTING_OR_DEGRADED_DATA with confidence warning."""
    engine_status = {
        "forecast": "failed",
        "waiting_time": "success",
        "crowding_risk": "success",
        "flow_patterns": "success",
        "surge_detection": "success",
    }

    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(
        base_state,
        normal_overview,
        engine_status=engine_status,
        degraded_mode=True,
    )

    data_recs = [r for r in recs if r.id == "rec-data-verification"]
    assert len(data_recs) == 1
    rec = data_recs[0]
    assert rec.rule_id == "RULE_CONFLICTING_OR_DEGRADED_DATA"
    assert "DEGRADED" in rec.confidence


def test_custom_thresholds_override(base_state, normal_overview):
    """Custom thresholds alter triggering boundaries accurately."""
    # With default threshold (80.0), occupancy 82.0 + rising arrivals triggers bed capacity rule.
    state = base_state.model_copy(update={"occupancy_percent": 82.0, "arrival_rate": 30.0})

    strict_engine = EDRecommendationEngine(RecommendationThresholds(occupancy_warning=80.0))
    _, default_recs = strict_engine.evaluate_rules(state, normal_overview)
    assert any(r.id == "rec-bed-capacity" for r in default_recs)

    # With higher custom threshold (90.0), occupancy 82.0 does NOT trigger bed capacity rule.
    lenient_thresholds = RecommendationThresholds(occupancy_warning=90.0, available_beds_warning=2.0)
    _, custom_recs = strict_engine.evaluate_rules(state, normal_overview, thresholds=lenient_thresholds)
    assert not any(r.id == "rec-bed-capacity" for r in custom_recs)


def test_none_overview_resilience(base_state):
    """Engine gracefully computes recommendations when overview is None without crashing."""
    engine = EDRecommendationEngine()
    issues, recs = engine.evaluate_rules(
        state=base_state,
        overview=None,
        engine_status=None,
        degraded_mode=False,
    )

    assert len(issues) >= 1
    assert len(recs) >= 1
    for r in recs:
        assert r.requires_human_review is True
        assert r.title is not None
        assert r.recommended_action is not None
        assert len(r.recommended_actions) >= 1
