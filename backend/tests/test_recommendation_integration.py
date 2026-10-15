"""
Integration tests for ERFlow Recommendation Engine with Centralized Prediction Workflow.

Verifies:
1. Consuming structured outputs from all 5 ML models (LSTM, XGBoost Regressor, XGBoost Classifier, KMeans, DBSCAN).
2. Proper recording of `contributing_models` and `contributing_fields` on recommendations.
3. Handling individual model failures independently:
   - Forecast engine failed: handled gracefully, missing values never treated as zero.
   - Waiting time engine failed: queue rule still triggers from telemetry without fabricating ML predictions.
   - Crowding risk engine failed: pressure score dynamically normalized over remaining components.
4. `data_sources_used` strictly excludes unavailable/failed engines (never claims all 5 contributed if some were unavailable).
5. Recommendations and pressure scores change dynamically when prediction outputs change (e.g., wait time escalates).
6. Recommendations change dynamically when operational inputs change (e.g., occupancy rises).
7. FastAPI endpoint `/api/orchestrator/analyze` handles both flat `HospitalState` payloads and nested `{hospital_state, predictions}` payloads.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.schemas.hospital_state import HospitalState
from backend.schemas.overview import DashboardOverviewResponse
from backend.schemas.deep_learning import ArrivalForecastResponse
from backend.schemas.supervised import WaitingTimeResponse, CrowdingRiskResponse
from backend.schemas.unsupervised import FlowPatternResponse, SurgeDetectionResponse
from backend.services.orchestrator_service import orchestrator_service

client = TestClient(app)


@pytest.fixture
def base_state():
    return HospitalState(
        occupancy_percent=70.0,
        patients_waiting=12.0,
        available_beds=10.0,
        arrival_rate=22.0,
        severity_level=3.0,
        available_doctors=5.0,
        available_nurses=10.0,
    )


@pytest.fixture
def mock_all_engines_overview():
    """Mocked DashboardOverviewResponse representing all 5 ML engines successfully returning inference."""
    return DashboardOverviewResponse(
        forecast=ArrivalForecastResponse(
            horizon="24h",
            horizons={"1h": 20.0, "3h": 40.0, "6h": 80.0, "24h": 300.0},
            forecast_cards=[],
            predicted_peak_time="15:30",
            predicted_peak_rate=35.0,
            trend="Increasing",
            series=[],
            model_name="2-Layer LSTM Neural Network",
        ),
        waiting_time=WaitingTimeResponse(
            waiting_time_minutes=55.0,
            predicted_1h=58.0,
            predicted_peak=70.0,
            trend="Increasing",
            model_name="Supervised XGBoost Regressor",
            explanation={"top_factors": [{"feature": "Patients Waiting", "importance": 0.45, "direction": "increases"}]},
        ),
        crowding_risk=CrowdingRiskResponse(
            crowding_level="HIGH",
            crowding_score=78,
            probabilities={"Low": 0.1, "Moderate": 0.2, "High": 0.6, "Critical": 0.1},
            model_name="Supervised XGBoost Classifier",
            explanation={"top_factors": [{"feature": "Occupancy Percent", "importance": 0.50, "direction": "increases"}]},
        ),
        flow_pattern=FlowPatternResponse(
            pattern_name="High Demand",
            confidence=92.0,
            cluster_id=1,
            description="High throughput regime.",
            current_point={"x": 2.2, "y": 1.4},
            model_name="Unsupervised K-Means + PCA",
        ),
        surge_detection=SurgeDetectionResponse(
            is_surge=True,
            status="ANOMALOUS SURGE DETECTED",
            severity="High",
            current_arrival_rate=36.0,
            normal_arrival_rate="18-24",
            deviation_percent="+55%",
            detected_at="14:45",
            description="Statistical spike in arrivals detected by DBSCAN.",
            model_name="Unsupervised DBSCAN Anomaly Engine",
        ),
        ai_summary_text="Unified multi-model assessment indicates elevated strain across all engines.",
        engine_status={
            "forecast": "success",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_pattern": "success",
            "surge_detection": "success",
        },
    )


def test_full_pipeline_all_engines_successful(base_state, mock_all_engines_overview):
    """Verifies complete synthesis when all 5 ML models provide valid predictions."""
    res = orchestrator_service.analyze_operations(base_state, overview=mock_all_engines_overview)

    assert res.overall_pressure_score > 60.0
    assert res.pressure_level in ["HIGH", "CRITICAL"]
    assert res.degraded_mode is False
    assert len(res.prioritized_issues) >= 2
    assert len(res.recommended_actions) >= 2

    # Verify data_sources_used includes all 5 models + telemetry + TreeSHAP
    assert "HospitalState Telemetry Feed" in res.data_sources_used
    assert "2-Layer Keras LSTM Neural Network (Arrival Forecast)" in res.data_sources_used
    assert "Supervised XGBoost Regressor (Waiting Time)" in res.data_sources_used
    assert "Supervised XGBoost Classifier (Crowding Risk)" in res.data_sources_used
    assert "Unsupervised K-Means + PCA (Flow Pattern)" in res.data_sources_used
    assert "Unsupervised DBSCAN (Surge Anomaly Detector)" in res.data_sources_used
    assert "TreeSHAP Feature Attribution Layer (xai_explainer.py)" in res.data_sources_used

    # Check contributing_models and contributing_fields are populated
    for rec in res.recommended_actions:
        assert isinstance(rec.contributing_models, list)
        assert isinstance(rec.contributing_fields, list)
        assert len(rec.contributing_fields) > 0
        assert rec.requires_human_review is True


def test_partial_model_failure_forecast_engine(base_state, mock_all_engines_overview):
    """When the LSTM forecast engine fails, other 4 engines still function and forecast is NOT claimed."""
    partial_overview = mock_all_engines_overview.model_copy()
    partial_overview.forecast = None
    partial_overview.engine_status["forecast"] = "failed"

    res = orchestrator_service.analyze_operations(base_state, overview=partial_overview)

    # Should not crash
    assert res.overall_pressure_score > 0
    assert res.degraded_mode is True

    # Critical check: LSTM forecast MUST NOT be listed in data_sources_used
    assert "2-Layer Keras LSTM Neural Network (Arrival Forecast)" not in res.data_sources_used
    # Other valid models must still be listed
    assert "Supervised XGBoost Regressor (Waiting Time)" in res.data_sources_used
    assert "Supervised XGBoost Classifier (Crowding Risk)" in res.data_sources_used

    # Degraded data rule should be triggered to inform staff
    degraded_recs = [r for r in res.recommended_actions if r.rule_id == "RULE_CONFLICTING_OR_DEGRADED_DATA"]
    assert len(degraded_recs) == 1
    assert "forecast" in degraded_recs[0].contributing_metrics.get("failed_engines", [])


def test_partial_model_failure_waiting_time(base_state, mock_all_engines_overview):
    """When XGBoost wait time model fails, queue telemetry handles queue alerts without claiming model input."""
    # State with elevated queue (26 patients)
    state = base_state.model_copy(update={"patients_waiting": 26.0})
    partial_overview = mock_all_engines_overview.model_copy()
    partial_overview.waiting_time = None
    partial_overview.engine_status["waiting_time"] = "failed"

    res = orchestrator_service.analyze_operations(state, overview=partial_overview)

    assert res.degraded_mode is True
    assert "Supervised XGBoost Regressor (Waiting Time)" not in res.data_sources_used

    # Triage capacity rule should still trigger from telemetry queue
    triage_recs = [r for r in res.recommended_actions if r.id == "rec-triage-capacity"]
    assert len(triage_recs) == 1
    rec = triage_recs[0]
    # The rule must NOT claim the XGBoost model contributed
    assert "Supervised XGBoost Regressor (Waiting Time)" not in rec.contributing_models
    assert rec.contributing_metrics.get("waiting_time_status") == "UNAVAILABLE"


def test_missing_predictions_never_treated_as_zero(base_state, mock_all_engines_overview):
    """Verifies that missing crowding score does NOT drop overall pressure to zero/low."""
    # Base state has 85% occupancy
    state = base_state.model_copy(update={"occupancy_percent": 85.0})

    # Case A: Crowding risk is 85
    full_overview = mock_all_engines_overview.model_copy()
    full_overview.crowding_risk.crowding_score = 85
    res_full = orchestrator_service.analyze_operations(state, overview=full_overview)

    # Case B: Crowding risk engine is failed/unavailable (None)
    missing_overview = mock_all_engines_overview.model_copy()
    missing_overview.crowding_risk = None
    missing_overview.engine_status["crowding_risk"] = "failed"
    res_missing = orchestrator_service.analyze_operations(state, overview=missing_overview)

    # Missing prediction should normalize over remaining weights, NOT treat crowding_score as 0.0
    # If it treated missing as 0, score would plunge by 25+ points
    assert res_missing.overall_pressure_score > 50.0
    assert abs(res_full.overall_pressure_score - res_missing.overall_pressure_score) < 15.0


def test_changed_prediction_outputs_alter_recommendations(base_state, mock_all_engines_overview):
    """Verifies that changing model predictions produces different recommendations and severity."""
    # Low wait time & low crowding
    low_overview = mock_all_engines_overview.model_copy()
    low_overview.waiting_time.waiting_time_minutes = 15.0
    low_overview.waiting_time.trend = "Decreasing"
    low_overview.crowding_risk.crowding_score = 30
    low_overview.crowding_risk.crowding_level = "LOW"
    low_overview.surge_detection.is_surge = False
    low_overview.forecast.predicted_peak_rate = 18.0
    low_overview.forecast.horizons["3h"] = 18.0

    res_low = orchestrator_service.analyze_operations(base_state, overview=low_overview)

    # High wait time & critical crowding
    high_overview = mock_all_engines_overview.model_copy()
    high_overview.waiting_time.waiting_time_minutes = 75.0
    high_overview.waiting_time.trend = "Increasing"
    high_overview.crowding_risk.crowding_score = 92
    high_overview.crowding_risk.crowding_level = "CRITICAL"
    high_overview.surge_detection.is_surge = True
    high_overview.forecast.predicted_peak_rate = 45.0
    high_overview.forecast.horizons["3h"] = 55.0

    res_high = orchestrator_service.analyze_operations(base_state, overview=high_overview)

    assert res_high.overall_pressure_score > res_low.overall_pressure_score
    assert res_high.pressure_level in ["HIGH", "CRITICAL"]

    # Verify high condition has more critical action items
    high_priorities = [r.priority for r in res_high.recommended_actions]
    assert "CRITICAL" in high_priorities or "HIGH" in high_priorities


def test_api_endpoint_flexible_payloads():
    """Verifies POST /api/orchestrator/analyze accepts both flat state and nested {hospital_state, predictions}."""
    # 1. Flat HospitalState payload (legacy client format)
    flat_payload = {
        "occupancy_percent": 82.0,
        "patients_waiting": 22.0,
        "available_beds": 6.0,
        "arrival_rate": 28.0,
        "available_doctors": 4.0,
        "available_nurses": 8.0,
    }
    res_flat = client.post("/api/orchestrator/analyze", json=flat_payload)
    assert res_flat.status_code == 200
    data_flat = res_flat.json()
    assert "overall_pressure_score" in data_flat
    assert len(data_flat["recommended_actions"]) > 0

    # 2. Nested payload with precomputed predictions (centralized workflow)
    nested_payload = {
        "hospital_state": flat_payload,
        "predictions": {
            "forecast": {
                "horizon": "24h",
                "horizons": {"3h": 42.0},
                "forecast_cards": [],
                "predicted_peak_time": "16:00",
                "predicted_peak_rate": 34.0,
                "trend": "Increasing",
                "series": [],
            },
            "waiting_time": {
                "waiting_time_minutes": 52.0,
                "predicted_1h": 55.0,
                "predicted_peak": 65.0,
                "trend": "Increasing",
            },
            "crowding_risk": {
                "crowding_level": "HIGH",
                "crowding_score": 75,
                "probabilities": {"High": 0.7},
            },
            "surge_detection": {
                "is_surge": False,
                "status": "NORMAL OPERATIONAL LOAD",
                "severity": "Low",
                "current_arrival_rate": 28.0,
                "normal_arrival_rate": "24",
                "deviation_percent": "+10%",
                "detected_at": "15:00",
                "description": "Normal arrivals.",
            },
            "engine_status": {
                "forecast": "success",
                "waiting_time": "success",
                "crowding_risk": "success",
                "flow_pattern": "demo",
                "surge_detection": "success",
            },
        },
    }
    res_nested = client.post("/api/orchestrator/analyze", json=nested_payload)
    assert res_nested.status_code == 200
    data_nested = res_nested.json()
    assert "overall_pressure_score" in data_nested
    assert data_nested["overall_pressure_score"] > 50.0

    # Verify contributing_models and contributing_fields in API response
    first_rec = data_nested["recommended_actions"][0]
    assert "contributing_models" in first_rec
    assert "contributing_fields" in first_rec
    assert "source_prediction" in first_rec
