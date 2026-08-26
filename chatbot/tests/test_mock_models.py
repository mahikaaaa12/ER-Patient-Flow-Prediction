from fastapi.testclient import TestClient
from main import app
from app.chatbot.chatbot_service import ChatbotService
from app.ml_service.mock_models import (
    MockCrowdingProvider,
    MockHighDemandProvider,
    MockMLProvider,
    MockPatientVolumeProvider,
    MockWaitingTimeProvider,
    dev_mock_provider,
)
from app.ml_service.model_registry import ModelRegistry, model_registry
from app.ml_service.prediction_service import PredictionService
from app.schemas.chat_schema import ChatRequest
from app.schemas.prediction_schema import (
    Intent,
    PredictionInputData,
    PredictionRequest,
)

client = TestClient(app)


# ==========================================================
# 1. Mock Provider Direct Contract Tests
# ==========================================================

def test_mock_patient_volume_provider():
    provider = MockPatientVolumeProvider()
    input_data = PredictionInputData(time_window="next_4_hours")
    response = provider.predict_patient_volume(input_data)

    assert response.is_mock is True
    assert response.prediction is None
    assert response.model_name == "mock_patient_volume_model"
    assert response.metadata["is_mock"] is True
    assert "DEVELOPMENT TEST RESULT ONLY" in response.metadata["notice"]


def test_mock_waiting_time_provider():
    provider = MockWaitingTimeProvider()
    input_data = PredictionInputData(triage_level="Urgent")
    response = provider.predict_waiting_time(input_data)

    assert response.is_mock is True
    assert response.prediction is None
    assert response.model_name == "mock_waiting_time_model"
    assert response.metadata["is_mock"] is True


def test_mock_crowding_provider():
    provider = MockCrowdingProvider()
    input_data = PredictionInputData()
    response = provider.predict_crowding(input_data)

    assert response.is_mock is True
    assert response.prediction is None
    assert response.model_name == "mock_crowding_model"
    assert response.metadata["is_mock"] is True


def test_mock_high_demand_provider():
    provider = MockHighDemandProvider()
    input_data = PredictionInputData()
    response = provider.predict_high_demand_period(input_data)

    assert response.is_mock is True
    assert response.prediction is None
    assert response.model_name == "mock_high_demand_model"
    assert response.metadata["is_mock"] is True


def test_unified_mock_ml_provider():
    provider = MockMLProvider()
    input_data = PredictionInputData()

    vol = provider.predict_patient_volume(input_data)
    assert vol.is_mock is True

    wait = provider.predict_waiting_time(input_data)
    assert wait.is_mock is True

    crowd = provider.predict_crowding(input_data)
    assert crowd.is_mock is True

    demand = provider.predict_high_demand_period(input_data)
    assert demand.is_mock is True


# ==========================================================
# 2. Mode Switching: USE_MOCK_MODE=True vs USE_MOCK_MODE=False
# ==========================================================

def test_prediction_service_in_mock_mode():
    # Explicitly activate mock mode
    service = PredictionService(use_mock_mode=True)
    req = PredictionRequest(intent=Intent.PATIENT_VOLUME, parameters={"time_window": "today"})
    result = service.get_prediction(req)

    assert result.is_mock is True
    assert result.is_available is True
    assert result.model_name == "mock_patient_volume_model"
    assert result.payload["is_mock"] is True


def test_prediction_service_in_real_registry_mode_without_models():
    # Empty registry in real mode (USE_MOCK_MODE=False)
    empty_registry = ModelRegistry()
    service = PredictionService(registry=empty_registry, use_mock_mode=False)

    req = PredictionRequest(intent=Intent.PATIENT_VOLUME, parameters={"time_window": "today"})
    result = service.get_prediction(req)

    assert result.is_mock is False
    assert result.is_available is False
    assert result.payload is None
    assert "unavailable" in result.error_message.lower()


# ==========================================================
# 3. End-to-End Chatbot Service with Mock Mode
# ==========================================================

def test_chatbot_service_with_mock_mode():
    service = ChatbotService()
    service.pred_service = PredictionService(use_mock_mode=True)

    request = ChatRequest(message="What is the expected patient volume?")
    response = service.process_message(request)

    assert response.intent == "PATIENT_VOLUME"
    assert response.data is not None
    assert response.data["is_mock"] is True
    assert "Development Mock Result" in response.response
    assert "not a real prediction" in response.response.lower()


def test_chatbot_service_with_real_mode_unavailable():
    service = ChatbotService()
    service.pred_service = PredictionService(registry=ModelRegistry(), use_mock_mode=False)

    request = ChatRequest(message="What is the expected patient volume?")
    response = service.process_message(request)

    assert response.intent == "PATIENT_VOLUME"
    assert response.data is None
    assert "not available yet" in response.response.lower()
