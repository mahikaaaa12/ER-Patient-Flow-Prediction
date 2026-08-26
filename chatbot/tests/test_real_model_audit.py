from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import app
from app.chatbot.chatbot_service import ChatbotService
from app.ml_service.model_adapters import BaseModelAdapter
from app.ml_service.model_registry import ModelRegistry
from app.ml_service.prediction_service import PredictionService
from app.schemas.chat_schema import ChatRequest
from app.schemas.prediction_schema import Intent, PredictionInputData

client = TestClient(app)


from app.ml_service.ml_interface import PatientVolumePredictor

class FailingModelAdapter(BaseModelAdapter, PatientVolumePredictor):
    """Failing model adapter for testing exception handling in REAL mode."""

    def __init__(self, model_name: str = "patient_volume_model"):
        super().__init__(model_artifact=object(), model_name=model_name)
        self.is_loaded = True

    def raw_predict(self, features):
        raise RuntimeError("Simulated internal ML model execution failure during inference.")

    def map_outputs(self, raw_output, input_data):
        return PredictionResponse(is_available=True, prediction=raw_output)

    def predict_patient_volume(self, input_data: PredictionInputData):
        return self.predict(input_data)


def test_health_endpoint_reports_real_mode():
    """Verify GET /health reports mode: REAL when mock mode is disabled."""
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "healthy"
    assert "mode" in json_data
    assert json_data["mode"] == "REAL"
    assert json_data["ml_mode"] == "REAL"


def test_real_mode_unregistered_model_returns_unavailable():
    """Verify that when USE_MOCK_MODE=False and no model is registered, unavailable status is returned with NO fake numbers."""
    registry = ModelRegistry()
    pred_service = PredictionService(registry=registry, use_mock_mode=False)

    for intent in [Intent.PATIENT_VOLUME, Intent.WAITING_TIME, Intent.CROWDING, Intent.HIGH_DEMAND_PERIOD, Intent.FLOW_PATTERN]:
        input_data = PredictionInputData(features={"hour_of_day": 14})

        if intent == Intent.PATIENT_VOLUME:
            resp = pred_service.predict_patient_volume(input_data)
        elif intent == Intent.WAITING_TIME:
            resp = pred_service.predict_waiting_time(input_data)
        elif intent == Intent.CROWDING:
            resp = pred_service.predict_crowding(input_data)
        elif intent == Intent.HIGH_DEMAND_PERIOD:
            resp = pred_service.predict_high_demand_period(input_data)
        else:
            resp = pred_service.predict_flow_pattern(input_data)

        assert resp.is_available is False
        assert resp.prediction is None
        assert resp.is_mock is False


def test_real_mode_failing_model_never_returns_mock_prediction():
    """Verify that if a real model raises an error during inference, no mock/fake predictions are generated."""
    registry = ModelRegistry()
    failing_adapter = FailingModelAdapter("patient_volume_model")
    registry.register_model("patient_volume_model", failing_adapter)

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry, use_mock_mode=False)

    response = service.process_message(ChatRequest(message="What is the expected patient volume?"))

    assert response.intent == "PATIENT_VOLUME"
    assert response.data is None
    assert "unavailable" in response.response.lower() or "not available yet" in response.response.lower()
    # Absolutely no numbers or mock results
    assert "mock" not in response.response.lower()


def test_no_silent_fallback_from_real_to_mock():
    """Verify that PredictionService in REAL mode never silently falls back to dev_mock_provider."""
    registry = ModelRegistry()
    pred_service = PredictionService(registry=registry, use_mock_mode=False)

    input_data = PredictionInputData(features={"hour_of_day": 14})
    vol_resp = pred_service.predict_patient_volume(input_data)

    assert vol_resp.is_available is False
    assert vol_resp.is_mock is False
    assert vol_resp.prediction is None
