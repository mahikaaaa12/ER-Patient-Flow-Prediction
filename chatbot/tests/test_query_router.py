import pytest
from app.chatbot.query_router import query_router, QueryCategory
from app.schemas.prediction_schema import Intent

def test_query_router_category_1_operational_prediction():
    # Waiting time query
    cat1 = query_router.route_query(Intent.WAITING_TIME, "What is the expected waiting time?", 0.95)
    assert cat1 == QueryCategory.OPERATIONAL_PREDICTION

    # Crowding query
    cat2 = query_router.route_query(Intent.CROWDING, "Is the emergency room crowded?", 0.92)
    assert cat2 == QueryCategory.OPERATIONAL_PREDICTION

    # Patient volume forecast query
    cat3 = query_router.route_query(Intent.PATIENT_VOLUME, "How many patient arrivals are forecasted?", 0.90)
    assert cat3 == QueryCategory.OPERATIONAL_PREDICTION

def test_query_router_category_2_knowledge_base():
    # Triage question
    cat1 = query_router.route_query(Intent.KNOWLEDGE_QUERY, "What are the ESI level 1 triage guidelines?", 0.95)
    assert cat1 == QueryCategory.KNOWLEDGE_BASE

    # Overcrowding policy question
    cat2 = query_router.route_query(Intent.UNKNOWN, "What is the hospital diversion policy during severe crowding?", 0.30)
    assert cat2 == QueryCategory.KNOWLEDGE_BASE

def test_query_router_category_3_general_conversational():
    # Greeting
    cat1 = query_router.route_query(Intent.GREETING, "Hello!", 0.95)
    assert cat1 == QueryCategory.GENERAL_CONVERSATIONAL

    # Help
    cat2 = query_router.route_query(Intent.HELP, "Help", 0.95)
    assert cat2 == QueryCategory.GENERAL_CONVERSATIONAL

    # Model info
    cat3 = query_router.route_query(Intent.MODEL_INFO, "How does the prediction model work?", 0.95)
    assert cat3 == QueryCategory.GENERAL_CONVERSATIONAL

    # Project info
    cat4 = query_router.route_query(Intent.PROJECT_INFO, "Tell me about this project", 0.95)
    assert cat4 == QueryCategory.GENERAL_CONVERSATIONAL

    # Medical Out-of-scope
    cat5 = query_router.route_query(Intent.OUT_OF_SCOPE_MEDICAL, "How to treat a burn?", 0.95)
    assert cat5 == QueryCategory.GENERAL_CONVERSATIONAL

def test_query_router_fallback_ambiguous():
    # Ambiguous low confidence query
    cat_fallback = query_router.route_query(Intent.UNKNOWN, "random gibberish text", 0.10)
    assert cat_fallback == QueryCategory.GENERAL_CONVERSATIONAL
