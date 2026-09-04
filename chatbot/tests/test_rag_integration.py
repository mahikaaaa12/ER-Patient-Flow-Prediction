import pytest
from app.chatbot.chatbot_service import chatbot_service
from app.schemas.chat_schema import ChatRequest

def test_chatbot_category_1_operational_query():
    req = ChatRequest(message="What is the predicted waiting time?")
    resp = chatbot_service.process_message(req)
    assert resp.response is not None
    assert resp.intent in ["WAITING_TIME", "GENERAL_STATUS"]

def test_chatbot_category_2_knowledge_query():
    req = ChatRequest(message="What are the Emergency Severity Index ESI level 1 triage guidelines?")
    resp = chatbot_service.process_message(req)
    assert resp.response is not None
    assert "Sources:" in resp.response or "er_triage_protocols.md" in resp.response
    assert resp.intent in ["KNOWLEDGE_QUERY", "WAITING_TIME"]

def test_chatbot_category_3_conversational_query():
    req = ChatRequest(message="Hello!")
    resp = chatbot_service.process_message(req)
    assert resp.response is not None
    assert "Emergency Room Patient Flow Assistant" in resp.response
    assert resp.intent == "GREETING"
