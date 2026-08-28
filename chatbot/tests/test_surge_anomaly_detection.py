import pytest
from app.ml_service.model_adapters import HighDemandModelAdapter
from app.schemas.prediction_schema import PredictionInputData, Intent, PredictionRequest
from app.ml_service.prediction_service import prediction_service
from app.ml_service.model_registry import model_registry


@pytest.fixture
def surge_adapter():
    """Returns an initialized HighDemandModelAdapter loaded with operational parameters."""
    adapter = HighDemandModelAdapter()
    adapter.params = {
        "baseline_mean_arrival": 18.0,
        "baseline_std_arrival": 4.5,
        "features": [
            "arrival_rate",
            "waiting_time_minutes",
            "severity_level",
            "occupancy_percent",
            "patients_per_bed",
            "patients_per_staff",
        ],
    }
    adapter.model_artifact = adapter.params
    return adapter


def test_surge_detection_normal_conditions(surge_adapter):
    """1. Normal conditions: Standard baseline arrivals (18 pts/hr), 50% occupancy, low queue -> No surge."""
    inp = PredictionInputData(
        features={
            "arrival_rate": 18.0,
            "occupancy_percent": 50.0,
            "patients_waiting": 10,
            "hour_of_day": 14,
        }
    )
    res = surge_adapter.predict_high_demand_period(inp)

    assert res.is_available is True
    assert isinstance(res.prediction, dict)
    assert res.prediction["is_high_demand_expected"] is False
    assert res.prediction["status"] == "NORMAL OPERATIONAL LOAD"
    assert res.prediction["severity"] == "Low"


def test_surge_detection_high_arrival_rate(surge_adapter):
    """2. High arrival rate: 42 pts/hr (exceeds mean + 1.96*std of 26.8 pts/hr) -> Anomalous Surge Detected."""
    inp = PredictionInputData(
        features={
            "arrival_rate": 42.0,
            "occupancy_percent": 60.0,
            "patients_waiting": 15,
            "hour_of_day": 18,
        }
    )
    res = surge_adapter.predict_high_demand_period(inp)

    assert res.is_available is True
    assert res.prediction["is_high_demand_expected"] is True
    assert res.prediction["status"] == "ANOMALOUS SURGE DETECTED"
    assert res.prediction["severity"] == "High"


def test_surge_detection_high_waiting_queue(surge_adapter):
    """3. High waiting queue: Elevated waiting queue/volume with arrival rate > normal -> Anomaly detected."""
    inp = PredictionInputData(
        features={
            "arrival_rate": 35.0,
            "occupancy_percent": 75.0,
            "patients_waiting": 60,
            "waiting_time_minutes": 110.0,
            "hour_of_day": 20,
        }
    )
    res = surge_adapter.predict_high_demand_period(inp)

    assert res.is_available is True
    assert res.prediction["is_high_demand_expected"] is True


def test_surge_detection_high_occupancy(surge_adapter):
    """4. High occupancy: Bed occupancy > 85% (e.g. 92%) -> Anomaly triggered due to system strain."""
    inp = PredictionInputData(
        features={
            "arrival_rate": 20.0,
            "occupancy_percent": 92.0,
            "patients_waiting": 20,
            "hour_of_day": 15,
        }
    )
    res = surge_adapter.predict_high_demand_period(inp)

    assert res.is_available is True
    assert res.prediction["is_high_demand_expected"] is True


def test_surge_detection_controlled_surge_scenario(surge_adapter):
    """5. Controlled surge scenario: Severe arrival spike (55 pts/hr) + 95% occupancy -> High Severity Surge."""
    inp = PredictionInputData(
        features={
            "arrival_rate": 55.0,
            "occupancy_percent": 95.0,
            "patients_waiting": 45,
            "hour_of_day": 19,
        }
    )
    res = surge_adapter.predict_high_demand_period(inp)

    assert res.is_available is True
    assert res.prediction["is_high_demand_expected"] is True
    assert res.prediction["severity"] == "High"
    assert "ANOMALOUS SURGE DETECTED" in res.prediction["status"]


def test_surge_detection_invalid_inputs(surge_adapter):
    """6. Invalid inputs: Missing or out-of-bound negative arrival rate handles safely with defaults."""
    inp = PredictionInputData(features={"arrival_rate": -5.0, "occupancy_percent": -10.0})
    res = surge_adapter.predict_high_demand_period(inp)

    # Adapter sanitizes / executes without crashing
    assert res.is_available is True
    assert res.prediction is not None
