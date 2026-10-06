import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.schemas.hospital_state import HospitalState
from backend.services.orchestrator_service import orchestrator_service

client = TestClient(app)


def test_orchestrator_service_normal_state():
    """Verify orchestrator service processes standard ER state and generates valid metrics with XAI details."""
    state = HospitalState(
        occupancy_percent=85.0,
        patients_waiting=25.0,
        available_beds=4.0,
        arrival_rate=32.0,
        available_doctors=4.0,
        available_nurses=8.0,
    )
    result = orchestrator_service.analyze_operations(state)

    assert result.overall_pressure_score >= 0.0 and result.overall_pressure_score <= 100.0
    assert result.pressure_level in ["LOW", "MODERATE", "HIGH", "CRITICAL"]
    assert result.workload_assessment.doctor_load_ratio > 0.0
    assert result.workload_assessment.nurse_load_ratio > 0.0
    assert len(result.prioritized_issues) > 0
    assert len(result.recommended_actions) > 0

    # Verify clinical safety compliance & XAI explanation details
    assert result.safety_disclaimer != ""
    for rec in result.recommended_actions:
        assert rec.requires_human_review is True
        assert rec.category in [
            "TRIAGE CAPACITY", "BED CAPACITY", "STAFFING",
            "ARRIVAL PRESSURE", "WAITING QUEUE", "CROWDING", "SURGE", "FLOW"
        ]
        assert rec.urgency in ["IMMEDIATE", "WITHIN 30 MIN", "WITHIN 1 HOUR", "NEXT SHIFT"]

        # Verify 6-question XAI explanation structure
        exp = rec.explanation_detail
        assert exp.detection_rationale != ""
        assert isinstance(exp.contributing_factors, list)
        assert exp.strongest_influencer != ""
        assert exp.triggering_prediction != ""
        assert exp.expected_operational_condition != ""
        assert exp.staff_review_guidance != ""
        assert exp.disclaimer != ""


def test_orchestrator_api_post_endpoint():
    """Test POST /api/orchestrator/analyze API endpoint with real ML models and XAI payload."""
    payload = {
        "occupancy_percent": 88.0,
        "patients_waiting": 28.0,
        "available_beds": 3.0,
        "arrival_rate": 35.0,
        "available_doctors": 3.0,
        "available_nurses": 6.0,
        "severity_level": 3.5,
    }
    response = client.post("/api/orchestrator/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "overall_pressure_score" in data
    assert "pressure_level" in data
    assert "workload_assessment" in data
    assert "prioritized_issues" in data
    assert "recommended_actions" in data
    assert data["pressure_level"] in ["HIGH", "CRITICAL"]
    assert len(data["recommended_actions"]) > 0

    first_rec = data["recommended_actions"][0]
    assert "explanation_detail" in first_rec
    exp = first_rec["explanation_detail"]
    assert "detection_rationale" in exp
    assert "contributing_factors" in exp
    assert "strongest_influencer" in exp
    assert "triggering_prediction" in exp
    assert "expected_operational_condition" in exp
    assert "staff_review_guidance" in exp


def test_orchestrator_api_get_endpoint():
    """Test GET /api/orchestrator/analyze default state endpoint."""
    response = client.get("/api/orchestrator/analyze")
    assert response.status_code == 200
    data = response.json()
    assert "overall_pressure_score" in data
    assert "workload_assessment" in data


def test_orchestrator_api_alias_endpoint():
    """Test POST /api/operations/orchestrator alias endpoint."""
    payload = {"occupancy_percent": 75.0, "patients_waiting": 15.0}
    response = client.post("/api/operations/orchestrator", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "overall_pressure_score" in data
