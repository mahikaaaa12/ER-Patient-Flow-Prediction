from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from app.core.config import settings
from app.ml_service.ml_interface import PatientVolumePredictor
from app.ml_service.model_registry import model_registry
from app.schemas.prediction_schema import PredictionInputData, PredictionResponse

client = TestClient(app)


# ==========================================================
# 1. Health Check Endpoint
# ==========================================================

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "healthy"
    assert "ml_model_available" in json_data
    assert "service" in json_data
    assert "environment" in json_data


def test_swagger_and_openapi_documentation():
    # Test Swagger UI is exposed
    docs_response = client.get("/docs")
    assert docs_response.status_code == 200
    assert "swagger" in docs_response.text.lower() or "html" in docs_response.headers.get("content-type", "")

    # Test OpenAPI JSON Schema
    openapi_response = client.get("/openapi.json")
    assert openapi_response.status_code == 200
    schema = openapi_response.json()
    assert "paths" in schema
    assert "/api/chat" in schema["paths"]
    assert "/health" in schema["paths"]


# ==========================================================
# 2. POST /api/chat - Query Type Tests
# ==========================================================

def test_chat_greeting_query():
    response = client.post("/api/chat", json={"message": "Good morning!"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "GREETING"
    assert data["data"] is None
    assert data["confidence"] > 0.7
    assert "Emergency Room Patient Flow Assistant" in data["response"]
    assert data["session_id"] is not None


def test_chat_project_question():
    response = client.post("/api/chat", json={"message": "What does this project do?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "PROJECT_INFO"
    assert "AI-Based Emergency Room Patient Flow Prediction" in data["response"]


def test_chat_patient_volume_question():
    response = client.post("/api/chat", json={"message": "How many patients are expected today?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "PATIENT_VOLUME"
    assert data["session_id"] is not None


def test_chat_waiting_time_question():
    response = client.post("/api/chat", json={"message": "What will the waiting time be for standard triage?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "WAITING_TIME"


def test_chat_crowding_question():
    response = client.post("/api/chat", json={"message": "Is the emergency room crowded right now?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "CROWDING"


def test_chat_high_demand_question():
    response = client.post("/api/chat", json={"message": "When will the ER be busiest tonight?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "HIGH_DEMAND_PERIOD"


def test_chat_unknown_question():
    response = client.post("/api/chat", json={"message": "xyz random gibberish 12345"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "UNKNOWN"
    assert "couldn't quite understand" in data["response"].lower()


def test_chat_medical_diagnosis_safety_refusal():
    # Attempt clinical diagnosis query
    response = client.post("/api/chat", json={"message": "I have severe chest pain and dizziness, diagnose me"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "OUT_OF_SCOPE_MEDICAL"
    assert data["data"] is None
    assert "cannot provide medical diagnosis" in data["response"]
    assert "emergency services" in data["response"].lower()


# ==========================================================
# 3. Session Creation & Session ID Handling
# ==========================================================

def test_session_creation_auto_generated():
    res = client.post("/api/chat", json={"message": "Hello"})
    assert res.status_code == 200
    sid = res.json()["session_id"]
    assert sid is not None
    assert len(sid) > 0


def test_session_creation_with_explicit_id():
    custom_sid = "unit-test-session-2026"
    res = client.post("/api/chat", json={"message": "Hello", "session_id": custom_sid})
    assert res.status_code == 200
    assert res.json()["session_id"] == custom_sid

    # Verify history is bound to that custom_sid
    hist_res = client.get(f"/api/chat/history/{custom_sid}")
    assert hist_res.status_code == 200
    assert hist_res.json()["session_id"] == custom_sid
    assert len(hist_res.json()["messages"]) == 2


# ==========================================================
# 4. Conversation History
# ==========================================================

def test_conversation_history_persistence():
    sid = "history-test-session"
    # Send first message
    client.post("/api/chat", json={"message": "Hello!", "session_id": sid})
    # Send second message
    client.post("/api/chat", json={"message": "What can you do?", "session_id": sid})

    # Retrieve history
    hist = client.get(f"/api/chat/history/{sid}")
    assert hist.status_code == 200
    messages = hist.json()["messages"]
    assert len(messages) == 4  # (user + bot) + (user + bot)
    assert messages[0]["sender"] == "user"
    assert messages[0]["text"] == "Hello!"
    assert messages[1]["sender"] == "bot"
    assert messages[2]["sender"] == "user"
    assert messages[3]["sender"] == "bot"

    # Delete session
    del_res = client.delete(f"/api/chat/session/{sid}")
    assert del_res.status_code == 200

    # Verify history is now empty
    hist_after = client.get(f"/api/chat/history/{sid}")
    assert len(hist_after.json()["messages"]) == 0


# ==========================================================
# 5. Behavior When ML Models Are Unavailable
# ==========================================================

def test_behavior_when_ml_models_are_unavailable():
    model_registry.clear()

    res = client.post("/api/chat", json={"message": "How many patients are expected?"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "PATIENT_VOLUME"
    assert data["data"] is None
    assert "not available yet" in data["response"].lower() or "unavailable" in data["response"].lower()


# ==========================================================
# 6. Mock ML Mode Integration
# ==========================================================

def test_mock_ml_mode_integration(monkeypatch):
    monkeypatch.setattr(settings, "USE_MOCK_MODE", True)

    res = client.post("/api/chat", json={"message": "What is the expected patient volume?"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "PATIENT_VOLUME"
    assert data["data"] is not None
    assert data["data"]["is_mock"] is True
    assert "Development Mock Result" in data["response"]


# ==========================================================
# 7. Malformed Requests & Validation Errors
# ==========================================================

def test_malformed_json_request():
    response = client.post(
        "/api/chat",
        content="not a valid json payload",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422


def test_missing_message_field():
    response = client.post("/api/chat", json={"context": {"time": "10:00"}})
    assert response.status_code == 422


# ==========================================================
# 8. Empty Messages
# ==========================================================

def test_empty_string_message():
    response = client.post("/api/chat", json={"message": ""})
    assert response.status_code == 422


# ==========================================================
# 9. Unexpected Internal Server Errors
# ==========================================================

def test_unexpected_internal_error_handling():
    with patch("app.api.chat_routes.chatbot_service.process_message") as mock_process:
        mock_process.side_effect = RuntimeError("Simulated unhandled internal crash")
        response = client.post("/api/chat", json={"message": "Hello"})
        assert response.status_code == 500
        assert "internal error occurred" in response.json()["detail"]
