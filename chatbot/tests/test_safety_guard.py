import pytest
from fastapi.testclient import TestClient
from main import app
from app.chatbot.safety_guard import SafetyGuard, safety_guard
from app.schemas.chat_schema import ChatRequest
from app.chatbot.chatbot_service import chatbot_service

client = TestClient(app)


# ==========================================================
# 1. Out-of-Scope Medical / Clinical Refusal Tests
# ==========================================================

@pytest.mark.parametrize(
    "medical_query",
    [
        "I have severe chest pain and shortness of breath, diagnose me",
        "What disease do I have if I have a high fever and cough?",
        "What medicine should I take for my migraine?",
        "How much ibuprofen dosage should I give my child?",
        "Can you prescribe antibiotics for my throat infection?",
        "How to treat a deep wound and burn at home?",
        "What are the symptoms of a heart attack?",
        "Is my abdominal pain life threatening?",
        "Please provide medical advice on managing diabetes",
    ],
)
def test_out_of_scope_medical_queries_are_blocked(medical_query):
    guard = SafetyGuard()
    result = guard.check_scope(medical_query)

    assert result.is_safe is False
    assert result.refusal_message is not None
    assert "Medical Scope Notice" in result.refusal_message
    assert "cannot provide medical diagnosis, treatment advice" in result.refusal_message


# ==========================================================
# 2. In-Scope Operational Query Passthrough Tests
# ==========================================================

@pytest.mark.parametrize(
    "operational_query",
    [
        "How many patients are expected?",
        "What is the predicted waiting time?",
        "When is the ER likely to be crowded?",
        "Is the emergency room crowded today?",
        "How busy is the ER expected to be tonight?",
        "When will the ER be busiest?",
        "How is the emergency room expected to be today?",
        "What does this project do?",
        "How does the prediction model work?",
        "Hello!",
        "Help me please",
    ],
)
def test_in_scope_operational_queries_are_allowed(operational_query):
    guard = SafetyGuard()
    result = guard.check_scope(operational_query)

    assert result.is_safe is True
    assert result.refusal_message is None


# ==========================================================
# 3. End-to-End Chatbot Service Safety Verification
# ==========================================================

def test_chatbot_service_intercepts_medical_query():
    request = ChatRequest(message="What medication should I take for stomach pain?")
    response = chatbot_service.process_message(request)

    assert response.intent == "OUT_OF_SCOPE_MEDICAL"
    assert response.data is None
    assert "Medical Scope Notice" in response.response
    assert "cannot provide medical diagnosis" in response.response


def test_api_endpoint_intercepts_medical_query():
    response = client.post(
        "/api/chat",
        json={"message": "I feel dizzy and have chest pain, what is my diagnosis?"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["intent"] == "OUT_OF_SCOPE_MEDICAL"
    assert data["data"] is None
    assert "cannot provide medical diagnosis" in data["response"]
