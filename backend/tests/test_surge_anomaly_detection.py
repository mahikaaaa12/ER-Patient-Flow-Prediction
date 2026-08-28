import pytest
from backend.services.unsupervised_service import unsupervised_service
from backend.schemas.hospital_state import HospitalState


def test_backend_surge_normal_conditions():
    """1. Normal conditions: Arrival rate 16 pts/hr at hour 14, 50% occupancy -> Normal load."""
    state = HospitalState(
        arrival_rate=16.0,
        occupancy_percent=50.0,
        patients_waiting=10,
        available_beds=15,
        available_doctors=6,
        available_nurses=10,
        severity_level=2.5,
        hour_of_day=14,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is False
    assert res.status == "NORMAL OPERATIONAL LOAD"
    assert res.severity == "Low"
    assert res.model_name == "Operational Surge Anomaly Detector"


def test_backend_surge_high_arrival_rate():
    """2. High arrival rate: 38 pts/hr at hour 14 (exceeds max baseline of 22*1.3 = 28.6) -> Surge Detected."""
    state = HospitalState(
        arrival_rate=38.0,
        occupancy_percent=60.0,
        patients_waiting=15,
        available_beds=10,
        available_doctors=5,
        available_nurses=8,
        severity_level=3.0,
        hour_of_day=14,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is True
    assert res.status == "ANOMALOUS SURGE DETECTED"
    assert res.model_name == "Operational Surge Anomaly Detector"


def test_backend_surge_high_waiting_queue():
    """3. High waiting queue: Large queue size (45 waiting) & wait time -> Surge Detected via strain."""
    state = HospitalState(
        arrival_rate=30.0,
        occupancy_percent=80.0,
        patients_waiting=45,
        available_beds=4,
        available_doctors=3,
        available_nurses=5,
        severity_level=4.0,
        hour_of_day=18,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is True
    assert res.status == "ANOMALOUS SURGE DETECTED"


def test_backend_surge_high_occupancy():
    """4. High occupancy: Occupancy 92% > 88% -> Surge Detected."""
    state = HospitalState(
        arrival_rate=18.0,
        occupancy_percent=92.0,
        patients_waiting=20,
        available_beds=2,
        available_doctors=4,
        available_nurses=6,
        severity_level=3.0,
        hour_of_day=15,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is True
    assert res.status == "ANOMALOUS SURGE DETECTED"


def test_backend_surge_controlled_surge_scenario():
    """5. Controlled surge scenario: 45 pts/hr arrival + 94% occupancy -> High Severity Surge."""
    state = HospitalState(
        arrival_rate=45.0,
        occupancy_percent=94.0,
        patients_waiting=50,
        available_beds=2,
        available_doctors=3,
        available_nurses=5,
        severity_level=4.5,
        hour_of_day=19,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is True
    assert res.severity == "High"
    assert res.status == "ANOMALOUS SURGE DETECTED"


def test_backend_surge_invalid_inputs():
    """6. Invalid inputs: Out-of-bounds or zero values handle gracefully without throwing uncaught exceptions."""
    state = HospitalState(
        arrival_rate=10.0,
        occupancy_percent=25.0,
        patients_waiting=2,
        available_beds=18,
        available_doctors=8,
        available_nurses=12,
        severity_level=1.5,
        hour_of_day=3,
    )
    res = unsupervised_service.detect_surge(state)

    assert res.is_surge is False
    assert res.status == "NORMAL OPERATIONAL LOAD"
    assert res.model_name == "Operational Surge Anomaly Detector"
