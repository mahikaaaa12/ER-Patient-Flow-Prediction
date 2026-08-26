from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from main import app
from app.chatbot.chatbot_service import ChatbotService
from app.chatbot.conversation_manager import ConversationManager
from app.chatbot.intent_detector import IntentDetector
from app.chatbot.response_generator import ResponseGenerator
from app.ml_service.ml_interface import (
    CrowdingPredictor,
    HighDemandPredictor,
    MLModelInterface,
    PatientVolumePredictor,
    WaitingTimePredictor,
)
from app.ml_service.model_registry import ModelRegistry, model_registry
from app.ml_service.prediction_service import PredictionService
from app.schemas.chat_schema import ChatRequest
from app.schemas.prediction_schema import (
    Intent,
    PredictionInputData,
    PredictionResponse,
)

client = TestClient(app)


# Mock Model implementations for flow testing
class MockVolumeModel(PatientVolumePredictor):
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={"predicted_volume": 38, "time_window": input_data.time_window or "next_4_hours"},
            confidence=0.94,
            model_name="xgb_volume_v1",
        )


class MockWaitTimeModel(WaitingTimePredictor):
    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={"estimated_wait_minutes": 20, "triage_level": input_data.triage_level or "Standard"},
            confidence=0.88,
            model_name="rf_wait_time_v1",
        )


class MockCrowdingModel(CrowdingPredictor):
    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={
                "crowding_level": "Moderate",
                "occupancy_rate_percent": 65.0,
                "status_summary": "ER beds are operating within normal capacity limits.",
            },
            confidence=0.91,
            model_name="crowding_nn_v1",
        )


class MockDemandModel(HighDemandPredictor):
    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction={
                "is_high_demand_expected": True,
                "peak_start_time": "19:00",
                "peak_end_time": "22:30",
                "risk_level": "High",
            },
            confidence=0.90,
            model_name="surge_rf_v1",
        )


class MockUnifiedModel(MLModelInterface):
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction={"predicted_volume": 40}, confidence=0.90, model_name="unified_v1")

    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction={"estimated_wait_minutes": 15}, confidence=0.85, model_name="unified_v1")

    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction={"crowding_level": "Low", "occupancy_rate_percent": 45.0, "status_summary": "Low occupancy."}, confidence=0.95, model_name="unified_v1")

    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(prediction={"is_high_demand_expected": False, "risk_level": "Low"}, confidence=0.92, model_name="unified_v1")


# ==========================================================
# 1. Non-Prediction Intents Flow (ML Service NOT called)
# ==========================================================

@pytest.mark.parametrize(
    "query, expected_intent, expected_keyword",
    [
        ("Hello there!", "GREETING", "Emergency Room Patient Flow Assistant"),
        ("What can you do?", "HELP", "Patient Volume"),
        ("Tell me about this project", "PROJECT_INFO", "AI-Based Emergency Room Patient Flow Prediction"),
        ("How does the prediction model work?", "MODEL_INFO", "machine learning"),
        ("xyz random gibberish 9988", "UNKNOWN", "couldn't quite understand"),
    ],
)
def test_non_prediction_intents_do_not_call_ml_service(query, expected_intent, expected_keyword):
    # Mock prediction service to ensure get_prediction is never called
    mock_pred_service = MagicMock(spec=PredictionService)
    service = ChatbotService()
    service.pred_service = mock_pred_service

    request = ChatRequest(message=query)
    response = service.process_message(request)

    assert response.intent == expected_intent
    assert response.data is None
    assert expected_keyword.lower() in response.response.lower()
    # Verify ML prediction service was not called
    mock_pred_service.get_prediction.assert_not_called()


# ==========================================================
# 2. Prediction-Related Intents with Missing ML Models
# ==========================================================

@pytest.mark.parametrize(
    "query, expected_intent",
    [
        ("How many patients are expected today?", "PATIENT_VOLUME"),
        ("What will the waiting time be for standard triage?", "WAITING_TIME"),
        ("Is the emergency room crowded right now?", "CROWDING"),
        ("When will the ER be busiest tonight?", "HIGH_DEMAND_PERIOD"),
        ("How is the emergency room expected to be today?", "GENERAL_STATUS"),
    ],
)
def test_prediction_intents_with_missing_models_return_graceful_response(query, expected_intent):
    # Empty registry -> models unavailable
    empty_registry = ModelRegistry()
    pred_service = PredictionService(registry=empty_registry)
    service = ChatbotService()
    service.pred_service = pred_service

    request = ChatRequest(message=query)
    response = service.process_message(request)

    assert response.intent == expected_intent
    assert "not available yet" in response.response.lower() or "unavailable" in response.response.lower()


# ==========================================================
# 3. Prediction-Related Intents with Registered ML Models
# ==========================================================

def test_full_pipeline_volume_prediction():
    registry = ModelRegistry()
    registry.register_model("patient_volume_model", MockVolumeModel())

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry)

    response = service.process_message(ChatRequest(message="What is the expected patient volume?"))
    assert response.intent == "PATIENT_VOLUME"
    assert response.data is not None
    assert response.data["predicted_volume"] == 38
    assert "38" in response.response


def test_full_pipeline_waiting_time_prediction():
    registry = ModelRegistry()
    registry.register_model("waiting_time_model", MockWaitTimeModel())

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry)

    response = service.process_message(ChatRequest(message="What will the waiting time be?"))
    assert response.intent == "WAITING_TIME"
    assert response.data is not None
    assert response.data["estimated_wait_minutes"] == 20
    assert "20 minutes" in response.response


def test_full_pipeline_crowding_prediction():
    registry = ModelRegistry()
    registry.register_model("crowding_model", MockCrowdingModel())

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry)

    response = service.process_message(ChatRequest(message="Is the emergency room crowded?"))
    assert response.intent == "CROWDING"
    assert response.data is not None
    assert response.data["crowding_level"] == "Moderate"
    assert "Moderate" in response.response


def test_full_pipeline_high_demand_prediction():
    registry = ModelRegistry()
    registry.register_model("high_demand_model", MockDemandModel())

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry)

    response = service.process_message(ChatRequest(message="When will the ER be busiest?"))
    assert response.intent == "HIGH_DEMAND_PERIOD"
    assert response.data is not None
    assert response.data["is_high_demand_expected"] is True
    assert "High Demand Alert" in response.response


# ==========================================================
# 4. End-to-End HTTP API Integration Flow
# ==========================================================

def test_api_chat_full_roundtrip_flow():
    # Make sure model registry is cleared for default unavailable behavior
    model_registry.clear()

    # Step 1: User message to API endpoint
    response = client.post("/api/chat", json={"message": "How many patients are expected?"})
    assert response.status_code == 200

    data = response.json()
    assert data["intent"] == "PATIENT_VOLUME"
    assert "not available yet" in data["response"].lower() or "unavailable" in data["response"].lower()
    assert data["data"] is None
    assert "session_id" in data

    # Step 2: Register a model and verify immediate activation through API
    model_registry.register_model("patient_volume_model", MockVolumeModel())
    response_with_model = client.post("/api/chat", json={"message": "How many patients are expected?"})
    assert response_with_model.status_code == 200

    data_with_model = response_with_model.json()
    assert data_with_model["intent"] == "PATIENT_VOLUME"
    assert data_with_model["data"]["predicted_volume"] == 38
    assert "38" in data_with_model["response"]

    # Step 3: Clean up
    model_registry.clear()


def test_context_retention_and_follow_up_query():
    registry = ModelRegistry()
    registry.register_model("patient_volume_model", MockVolumeModel())

    service = ChatbotService()
    service.pred_service = PredictionService(registry=registry)

    # Turn 1: User asks for patient volume tomorrow
    res1 = service.process_message(ChatRequest(message="What is the expected patient volume tomorrow?", session_id="followup-session-001"))
    assert res1.intent == "PATIENT_VOLUME"
    assert res1.data is not None
    assert res1.data["predicted_volume"] == 38

    # Verify context saved in ConversationManager
    ctx = service.conv_mgr.get_prediction_context("followup-session-001")
    assert ctx is not None
    assert ctx["intent"] == "PATIENT_VOLUME"

    # Turn 2: Follow-up query "What about evening?"
    res2 = service.process_message(ChatRequest(message="What about evening?", session_id="followup-session-001"))
    assert res2.intent == "PATIENT_VOLUME"
    assert res2.data is not None
    assert res2.data["predicted_volume"] == 38
    assert "evening" in res2.response.lower()
