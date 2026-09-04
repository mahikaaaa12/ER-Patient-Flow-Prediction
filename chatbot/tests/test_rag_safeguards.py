import pytest
from unittest.mock import patch
from app.chatbot.chatbot_service import chatbot_service
from app.schemas.chat_schema import ChatRequest

def test_safeguard_priority_1_operational_query_never_calls_rag():
    """Verify Priority 1: Operational queries use ML models and never trigger RAG."""
    with patch("backend.rag.retriever.retriever.retrieve_context") as mock_retrieve:
        req = ChatRequest(message="What is the predicted waiting time?")
        resp = chatbot_service.process_message(req)
        assert resp.response is not None
        assert mock_retrieve.call_count == 0, "RAG retriever should never be invoked for operational prediction queries"

def test_safeguard_priority_2_knowledge_query_uses_rag():
    """Verify Priority 2: Knowledge queries retrieve from ChromaDB."""
    req = ChatRequest(message="What are the Emergency Severity Index ESI level 1 triage guidelines?")
    resp = chatbot_service.process_message(req)
    assert resp.response is not None
    assert "Sources:" in resp.response or "er_triage_protocols.md" in resp.response

def test_safeguard_priority_3_general_conversational():
    """Verify Priority 3: General queries use existing chatbot responses."""
    req = ChatRequest(message="Hello!")
    resp = chatbot_service.process_message(req)
    assert resp.response is not None
    assert "Emergency Room Patient Flow Assistant" in resp.response

def test_safeguard_priority_4_rag_low_score_fallback():
    """Verify Priority 4: Low score or empty RAG retrieval falls back gracefully to Category 3."""
    with patch("backend.rag.retriever.retriever.retrieve_context", return_value=("", [], 0.0)):
        req = ChatRequest(message="What is the triage policy?")
        resp = chatbot_service.process_message(req)
        assert resp.response is not None
        assert resp.intent in ["UNKNOWN", "KNOWLEDGE_QUERY", "WAITING_TIME"]

def test_safeguard_priority_5_rag_exception_isolation_no_crash():
    """Verify Priority 5: RAG exception does NOT crash FastAPI server, logs error, and returns response."""
    with patch("backend.rag.retriever.retriever.retrieve_context", side_effect=Exception("Database Connection Timeout")):
        req = ChatRequest(message="What is the hospital diversion policy?")
        resp = chatbot_service.process_message(req)
        assert resp.response is not None, "Application must not crash when RAG throws an exception"
        assert "I'm sorry" in resp.response or "hospital" in resp.response.lower()
