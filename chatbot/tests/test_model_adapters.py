from app.ml_service.model_adapters import (
    BaseModelAdapter,
    CrowdingModelAdapter,
    HighDemandModelAdapter,
    PatientVolumeModelAdapter,
    WaitingTimeModelAdapter,
)
from app.ml_service.model_registry import model_registry
from app.ml_service.prediction_service import PredictionService
from app.schemas.prediction_schema import (
    Intent,
    PredictionInputData,
    PredictionRequest,
    PredictionResponse,
)


class DummyEstimator:
    """Mock ML estimator simulating scikit-learn / xgboost .predict() method."""

    def __init__(self, return_val):
        self.return_val = return_val

    def predict(self, X):
        return self.return_val


def test_base_adapter_unloaded_state():
    adapter = PatientVolumeModelAdapter(model_artifact=None)
    assert adapter.is_loaded() is False

    response = adapter.predict_patient_volume(PredictionInputData())
    assert response.is_available is False
    assert "not loaded" in response.error_message.lower()


def test_patient_volume_model_adapter_with_callable():
    # Model artifact as a simple lambda / callable
    dummy_model = lambda features: [45]
    adapter = PatientVolumeModelAdapter(
        model_artifact=dummy_model,
        model_name="test_rf_volume",
        model_version="1.2.0",
    )
    assert adapter.is_loaded() is True

    input_data = PredictionInputData(time_window="next_4_hours")
    response = adapter.predict_patient_volume(input_data)

    assert response.is_available is True
    assert response.prediction["predicted_volume"] == 45
    assert response.prediction["time_window"] == "next_4_hours"
    assert response.model_name == "test_rf_volume"


def test_waiting_time_model_adapter_with_estimator():
    dummy_model = DummyEstimator(return_val=25)
    adapter = WaitingTimeModelAdapter(
        model_artifact=dummy_model,
        model_name="xgboost_wait_time",
    )

    input_data = PredictionInputData(triage_level="Urgent")
    response = adapter.predict_waiting_time(input_data)

    assert response.is_available is True
    assert response.prediction["estimated_wait_minutes"] == 25
    assert response.prediction["triage_level"] == "Urgent"


def test_crowding_model_adapter_with_dict():
    dummy_model = DummyEstimator(
        return_val={"crowding_level": "High", "occupancy_rate_percent": 88}
    )
    adapter = CrowdingModelAdapter(model_artifact=dummy_model)

    response = adapter.predict_crowding(PredictionInputData())
    assert response.is_available is True
    assert response.prediction["crowding_level"] == "High"
    assert response.prediction["occupancy_rate_percent"] == 88


def test_high_demand_model_adapter():
    dummy_model = DummyEstimator(return_val=True)
    adapter = HighDemandModelAdapter(model_artifact=dummy_model)

    response = adapter.predict_high_demand_period(PredictionInputData())
    assert response.is_available is True
    assert response.prediction["is_high_demand_expected"] is True
    assert response.prediction["risk_level"] == "High"


def test_custom_preprocessor_and_postprocessor():
    dummy_model = DummyEstimator(return_val=[99])

    def custom_preprocessor(inp: PredictionInputData):
        return [[inp.historical_patient_count or 10, 1]]

    def custom_postprocessor(raw_out, inp: PredictionInputData):
        return PredictionResponse(
            prediction={"custom_metric": raw_out[0] * 2},
            confidence=0.99,
            model_name="custom_pipeline",
            is_available=True,
        )

    adapter = PatientVolumeModelAdapter(
        model_artifact=dummy_model,
        preprocessor=custom_preprocessor,
        postprocessor=custom_postprocessor,
    )

    response = adapter.predict_patient_volume(PredictionInputData(historical_patient_count=15))
    assert response.is_available is True
    assert response.prediction["custom_metric"] == 198


def test_end_to_end_prediction_service_with_registered_adapter():
    model_registry.clear()
    estimator = DummyEstimator(return_val=50)
    adapter = PatientVolumeModelAdapter(model_artifact=estimator, model_name="prod_volume_model")

    # Register adapter into registry
    model_registry.register_model("patient_volume_model", adapter)

    service = PredictionService(registry=model_registry, use_mock_mode=False)
    req = PredictionRequest(intent=Intent.PATIENT_VOLUME, parameters={"time_window": "morning"})
    result = service.get_prediction(req)

    assert result.is_available is True
    assert result.payload["predicted_volume"] == 50
    assert result.model_name == "prod_volume_model"

    model_registry.clear()
