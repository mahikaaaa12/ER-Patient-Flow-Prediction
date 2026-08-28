import pytest
from backend.schemas.hospital_state import HospitalState
from backend.services.supervised_service import supervised_service
from backend.services.unsupervised_service import unsupervised_service


def test_backend_scenario_quiet_shift():
    state = HospitalState(
        arrival_rate=10.0,
        patients_waiting=5,
        occupancy_percent=25.0,
        available_beds=15,
        available_doctors=8,
        available_nurses=12,
        severity_level=2.0,
        hour_of_day=3,
    )
    wt = supervised_service.predict_waiting_time(state)
    cr = supervised_service.predict_crowding_risk(state)
    surge = unsupervised_service.detect_surge(state)

    assert wt.waiting_time_minutes > 0
    assert cr.crowding_level in ["LOW", "MODERATE"]
    assert surge.is_surge is False


def test_backend_scenario_surge_shift():
    state = HospitalState(
        arrival_rate=52.0,
        patients_waiting=58,
        occupancy_percent=96.0,
        available_beds=2,
        available_doctors=3,
        available_nurses=5,
        severity_level=4.2,
        hour_of_day=20,
    )
    wt = supervised_service.predict_waiting_time(state)
    cr = supervised_service.predict_crowding_risk(state)
    surge = unsupervised_service.detect_surge(state)

    assert wt.waiting_time_minutes > 40.0
    assert cr.crowding_level in ["HIGH", "CRITICAL"]
    assert surge.is_surge is True
