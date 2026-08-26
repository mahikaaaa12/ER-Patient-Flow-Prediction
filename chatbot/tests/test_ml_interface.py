import pytest
from app.ml_service.ml_interface import (
    BaseMLModel,
    CrowdingPredictor,
    HighDemandPredictor,
    MLModelInterface,
    ModelNotAvailableError,
    PatientVolumePredictor,
    WaitingTimePredictor,
)
from app.ml_service.model_registry import ModelRegistry
from app.ml_service.prediction_service import PredictionService
from app.schemas.prediction_schema import (
    Intent,
    PredictionInputData,
    PredictionRequest,
    PredictionResponse,
)


# Test mock predictor implementing the interface contract
class CustomVolumePredictor(PatientVolumePredictor):
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction=50,
            confidence=0.92,
            model_name="xgboost_volume_v1",
            model_version="1.0.0",
            metadata={"time_window": input_data.time_window or "next_4_hours"},
        )


class CustomUnifiedPredictor(MLModelInterface):
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction=45, confidence=0.88, model_name="unified_er_v1")

    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction=30, confidence=0.85, model_name="unified_er_v1")

    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={"crowding_level": "Moderate", "occupancy_rate": 72.0},
            confidence=0.90,
            model_name="unified_er_v1",
        )

    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={"is_surge": False, "risk_level": "Low"},
            confidence=0.89,
            model_name="unified_er_v1",
        )


# ==========================================
# 1. Model Registry Tests
# ==========================================

def test_model_registry_registration_and_retrieval():
    registry = ModelRegistry()
    assert registry.list_models() == []
    assert registry.has_model("patient_volume_model") is False
    assert registry.get_model("patient_volume_model") is None

    # Register model
    volume_predictor = CustomVolumePredictor()
    registry.register_model("patient_volume_model", volume_predictor)

    assert registry.has_model("patient_volume_model") is True
    assert registry.get_model("patient_volume_model") == volume_predictor
    assert "patient_volume_model" in registry.list_models()

    # Unregister model
    unregistered = registry.unregister_model("patient_volume_model")
    assert unregistered is True
    assert registry.has_model("patient_volume_model") is False
    assert registry.get_model("patient_volume_model") is None


def test_model_registry_validation():
    registry = ModelRegistry()
    with pytest.raises(ValueError):
        registry.register_model("", CustomVolumePredictor())

    with pytest.raises(ValueError):
        registry.register_model("test_model", None)


def test_model_registry_unified_interface():
    registry = ModelRegistry()
    assert registry.get_unified_interface() is None

    unified = CustomUnifiedPredictor()
    registry.set_unified_interface(unified)
    assert registry.get_unified_interface() == unified


# ==========================================
# 2. Missing Model Handling Tests
# ==========================================

def test_prediction_service_when_models_missing():
    # Empty registry with no models registered
    empty_registry = ModelRegistry()
    service = PredictionService(registry=empty_registry)

    input_data = PredictionInputData(time_window="next_4_hours")

    # Volume prediction when missing
    vol_res = service.predict_patient_volume(input_data)
    assert vol_res.is_available is False
    assert vol_res.prediction is None
    assert vol_res.error_message == "The prediction model is currently unavailable."

    # Wait time prediction when missing
    wait_res = service.predict_waiting_time(input_data)
    assert wait_res.is_available is False
    assert wait_res.prediction is None

    # Crowding prediction when missing
    crowd_res = service.predict_crowding(input_data)
    assert crowd_res.is_available is False
    assert crowd_res.prediction is None

    # High demand prediction when missing
    demand_res = service.predict_high_demand_period(input_data)
    assert demand_res.is_available is False
    assert demand_res.prediction is None


def test_prediction_service_intent_dispatch_missing_model():
    empty_registry = ModelRegistry()
    service = PredictionService(registry=empty_registry)

    req = PredictionRequest(intent=Intent.PATIENT_VOLUME, parameters={"time_window": "today"})
    result = service.get_prediction(req)

    assert result.intent == Intent.PATIENT_VOLUME
    assert result.is_available is False
    assert result.payload is None
    assert result.error_message == "The prediction model is currently unavailable."


# ==========================================
# 3. Prediction Service with Registered Models
# ==========================================

def test_prediction_service_with_registered_individual_model():
    registry = ModelRegistry()
    registry.register_model("patient_volume_model", CustomVolumePredictor())
    service = PredictionService(registry=registry)

    input_data = PredictionInputData(time_window="next_4_hours")
    response = service.predict_patient_volume(input_data)

    assert response.is_available is True
    assert response.prediction == 50
    assert response.confidence == 0.92
    assert response.model_name == "xgboost_volume_v1"


def test_prediction_service_with_unified_interface():
    registry = ModelRegistry()
    registry.set_unified_interface(CustomUnifiedPredictor())
    service = PredictionService(registry=registry)

    # Test all 4 prediction tasks through unified interface
    input_data = PredictionInputData()

    vol = service.predict_patient_volume(input_data)
    assert vol.is_available is True
    assert vol.prediction == 45

    wait = service.predict_waiting_time(input_data)
    assert wait.is_available is True
    assert wait.prediction == 30

    crowd = service.predict_crowding(input_data)
    assert crowd.is_available is True
    assert crowd.prediction["crowding_level"] == "Moderate"

    demand = service.predict_high_demand_period(input_data)
    assert demand.is_available is True
    assert demand.prediction["risk_level"] == "Low"


# ==========================================
# 4. Interface Error Recovery Tests
# ==========================================

class FaultyPredictor(PatientVolumePredictor):
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        raise RuntimeError("Internal numerical calculation error")


def test_prediction_service_handles_model_exceptions_gracefully():
    registry = ModelRegistry()
    registry.register_model("patient_volume_model", FaultyPredictor())
    service = PredictionService(registry=registry)

    input_data = PredictionInputData()
    response = service.predict_patient_volume(input_data)

    # Must NOT crash, should return controlled unavailable response
    assert response.is_available is False
    assert response.prediction is None
    assert "Internal numerical calculation error" in response.error_message
