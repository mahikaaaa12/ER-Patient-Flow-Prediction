import pytest
from app.chatbot.intent_detector import IntentDetector
from app.schemas.prediction_schema import Intent


def test_intent_detection_return_format():
    detector = IntentDetector()
    result = detector.detect_intent("Hello")
    assert isinstance(result, dict)
    assert "intent" in result
    assert "confidence" in result
    assert isinstance(result["confidence"], float)


def test_intent_greeting():
    detector = IntentDetector()
    for text in ["Hello", "Hi there!", "Good morning", "Hey"]:
        result = detector.detect_intent(text)
        assert result["intent"] == Intent.GREETING.value
        assert result["confidence"] >= 0.90


def test_intent_help():
    detector = IntentDetector()
    for text in ["Help me please", "What can you do?", "How to use", "Show commands"]:
        result = detector.detect_intent(text)
        assert result["intent"] == Intent.HELP.value
        assert result["confidence"] >= 0.88


def test_required_natural_questions_patient_volume():
    detector = IntentDetector()
    questions = [
        "What will patient arrivals look like tomorrow?",
        "How many patients are expected?",
        "What is the forecasted patient volume for today?",
        "Expected patient count for next 4 hours",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.PATIENT_VOLUME.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_required_natural_questions_waiting_time():
    detector = IntentDetector()
    questions = [
        "How long will patients have to wait?",
        "What will the waiting time be?",
        "How long is the wait?",
        "Estimated wait time for standard triage",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.WAITING_TIME.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_required_natural_questions_crowding():
    detector = IntentDetector()
    questions = [
        "Will the ER be crowded?",
        "Is the emergency room crowded?",
        "How busy is the emergency department right now?",
        "Check ED occupancy rate and congestion",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.CROWDING.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_required_natural_questions_high_demand_period():
    detector = IntentDetector()
    questions = [
        "When will the ER be busiest?",
        "Are there any surge periods?",
        "High demand period forecast",
        "When is the peak rush hour expected?",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.HIGH_DEMAND_PERIOD.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_required_natural_questions_flow_pattern():
    detector = IntentDetector()
    questions = [
        "What patterns do you see in patient flow?",
        "Are there unusual patient-flow patterns?",
        "What patient flow pattern cluster does the ER belong to?",
        "Explain the k-means clustering demand regime",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.FLOW_PATTERN.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_intent_general_status():
    detector = IntentDetector()
    questions = [
        "How is the emergency room expected to be today?",
        "Give me the ER general status overview",
        "Overall patient flow summary",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.GENERAL_STATUS.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_intent_model_info():
    detector = IntentDetector()
    questions = [
        "How does the prediction model work?",
        "What ML model is used for patient flow forecasting?",
        "Explain the model architecture",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.MODEL_INFO.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_intent_project_info():
    detector = IntentDetector()
    questions = [
        "What does this project do?",
        "Tell me about this project",
        "Who built this application?",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.PROJECT_INFO.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.85


def test_out_of_scope_medical_queries():
    detector = IntentDetector()
    questions = [
        "I have severe chest pain and shortness of breath",
        "What medicine should I take for my migraine?",
        "Diagnose me if I have a high fever",
    ]
    for q in questions:
        result = detector.detect_intent(q)
        assert result["intent"] == Intent.OUT_OF_SCOPE_MEDICAL.value, f"Failed for query: {q}"
        assert result["confidence"] >= 0.90


def test_ambiguous_and_single_word_inputs():
    detector = IntentDetector()

    # Vague single words should yield UNKNOWN due to confidence penalty (< 0.50)
    for vague in ["time", "busy", "surge", "volume", "flow"]:
        result = detector.detect_intent(vague)
        assert result["intent"] == Intent.UNKNOWN.value, f"Single vague word '{vague}' should return UNKNOWN"
        assert result["confidence"] <= 0.50

    # Garbage / un-matched input
    result_junk = detector.detect_intent("asdfghjkl")
    assert result_junk["intent"] == Intent.UNKNOWN.value
    assert result_junk["confidence"] <= 0.50

    # Empty input
    result_empty = detector.detect_intent("")
    assert result_empty["intent"] == Intent.UNKNOWN.value
    assert result_empty["confidence"] == 0.0
