import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_api_chat_operational_prediction_route():
    """Verify POST /api/chat continues to handle operational ML queries seamlessly."""
    response = client.post("/api/chat", json={"message": "What is the predicted waiting time?"})
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "intent" in data
    assert "session_id" in data
    assert data["intent"] in ["WAITING_TIME", "GENERAL_STATUS"]

def test_api_chat_knowledge_rag_route():
    """Verify POST /api/chat handles RAG knowledge queries additively."""
    response = client.post("/api/chat", json={"message": "What are the Emergency Severity Index ESI level 1 triage guidelines?"})
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert "intent" in data
    assert "session_id" in data
    assert data["intent"] in ["KNOWLEDGE_QUERY", "WAITING_TIME"]

def test_api_chat_conversational_route():
    """Verify POST /api/chat handles general greetings."""
    response = client.post("/api/chat", json={"message": "Hello!"})
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["intent"] == "GREETING"

def test_api_rag_query_dedicated_endpoint():
    """Verify dedicated POST /api/rag/query endpoint for direct knowledge base search."""
    response = client.post("/api/rag/query", json={"query": "What is the hospital diversion policy during severe ER crowding?", "top_k": 2})
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "found" in data
    assert "confidence" in data
    assert "citations" in data
    assert "sources" in data

def test_api_chat_sanitized_error_handling():
    """Verify endpoints handle invalid payloads gracefully without exposing raw tracebacks."""
    response = client.post("/api/chat", json={"invalid_field": 123})
    assert response.status_code == 422  # Pydantic validation error
    data = response.json()
    assert "detail" in data
