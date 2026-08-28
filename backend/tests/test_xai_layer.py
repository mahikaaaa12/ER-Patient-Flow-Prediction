import pytest
import numpy as np
from backend.services.supervised_service import supervised_service
from backend.schemas.hospital_state import HospitalState


def test_backend_xai_waiting_time_explanation():
    state = HospitalState(
        arrival_rate=32.0,
        occupancy_percent=82.0,
        patients_waiting=24,
        available_beds=8,
        available_doctors=5,
        available_nurses=9,
        severity_level=3.0,
        hour_of_day=18,
    )

    res = supervised_service.predict_waiting_time(state)
    assert res.explanation is not None
    assert "top_factors" in res.explanation
    assert len(res.explanation["top_factors"]) > 0

    top = res.explanation["top_factors"][0]
    assert "feature" in top
    assert top["direction"] in ["increases", "decreases"]
    assert 0.0 <= top["importance"] <= 1.0


def test_backend_xai_crowding_risk_explanation():
    state = HospitalState(
        arrival_rate=32.0,
        occupancy_percent=82.0,
        patients_waiting=24,
        available_beds=8,
        available_doctors=5,
        available_nurses=9,
        severity_level=3.0,
        hour_of_day=18,
    )

    res = supervised_service.predict_crowding_risk(state)
    assert res.explanation is not None
    assert "top_factors" in res.explanation
    assert len(res.explanation["top_factors"]) > 0

    top = res.explanation["top_factors"][0]
    assert "feature" in top
    assert top["direction"] in ["increases", "decreases"]
    assert 0.0 <= top["importance"] <= 1.0
