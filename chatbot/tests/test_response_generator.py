from app.chatbot.response_generator import ResponseGenerator
from app.schemas.prediction_schema import Intent, PredictionResponse, PredictionResult


def test_greeting_response():
    generator = ResponseGenerator()
    reply = generator.generate_response(Intent.GREETING)
    assert "Emergency Room Patient Flow Assistant" in reply
    assert "Hello" in reply


def test_help_response():
    generator = ResponseGenerator()
    reply = generator.generate_response(Intent.HELP)
    assert "Patient Volume" in reply
    assert "Waiting Times" in reply
    assert "ED Crowding" in reply
    assert "High Demand Surge" in reply


def test_project_info_response():
    generator = ResponseGenerator()
    reply = generator.generate_response(Intent.PROJECT_INFO)
    assert "AI-Based Emergency Room Patient Flow Prediction" in reply
    assert "resource allocation" in reply


def test_model_info_response():
    generator = ResponseGenerator()
    reply = generator.generate_response(Intent.MODEL_INFO)
    assert "machine learning" in reply.lower()


def test_unknown_response():
    generator = ResponseGenerator()
    reply = generator.generate_response(Intent.UNKNOWN)
    assert "couldn't quite understand" in reply.lower()


# ==========================================================
# Prediction Unavailable Tests (No Invented Numbers)
# ==========================================================

def test_prediction_unavailable_response():
    generator = ResponseGenerator()
    for intent in [Intent.PATIENT_VOLUME, Intent.WAITING_TIME, Intent.CROWDING, Intent.HIGH_DEMAND_PERIOD, Intent.FLOW_PATTERN]:
        result = PredictionResult(intent=intent, is_available=False, payload=None)
        reply = generator.generate_response(intent, prediction_result=result)
        assert reply == "The prediction is currently unavailable because the required model is not available yet."


# ==========================================================
# Grounded ML Prediction Formatting Tests
# ==========================================================

def test_patient_volume_grounded_response():
    generator = ResponseGenerator()

    # Case A: Volume = 145, no confidence
    payload_145 = {"predicted_volume": 145, "time_window": "the requested period"}
    result_145 = PredictionResult(intent=Intent.PATIENT_VOLUME, is_available=True, payload=payload_145)
    reply_145 = generator.generate_response(Intent.PATIENT_VOLUME, prediction_result=result_145)
    assert reply_145 == "The model forecasts approximately **145** patient arrivals for **the requested period**."

    # Case B: Volume = 145, with confidence = 0.91
    raw = PredictionResponse(prediction=145, confidence=0.91)
    result_conf = PredictionResult(intent=Intent.PATIENT_VOLUME, is_available=True, payload=payload_145, raw_response=raw)
    reply_conf = generator.generate_response(Intent.PATIENT_VOLUME, prediction_result=result_conf)
    assert reply_conf == "The model forecasts approximately **145** patient arrivals for **the requested period**, with an estimated confidence of 91%."


def test_crowding_grounded_response_with_and_without_confidence():
    generator = ResponseGenerator()

    # Case A: Crowding risk = HIGH, confidence = 0.84
    payload_high = {"crowding_level": "HIGH"}
    raw_high = PredictionResponse(prediction="HIGH", confidence=0.84)
    result_high = PredictionResult(intent=Intent.CROWDING, is_available=True, payload=payload_high, raw_response=raw_high)
    reply_high = generator.generate_response(Intent.CROWDING, prediction_result=result_high)
    assert reply_high == "The crowding model predicts **HIGH** risk, with an estimated confidence of 84%."

    # Case B: Crowding risk = HIGH, NO confidence provided
    result_no_conf = PredictionResult(intent=Intent.CROWDING, is_available=True, payload=payload_high)
    reply_no_conf = generator.generate_response(Intent.CROWDING, prediction_result=result_no_conf)
    assert reply_no_conf == "The crowding model predicts **HIGH** risk."
    assert "confidence" not in reply_no_conf


def test_waiting_time_grounded_response():
    generator = ResponseGenerator()
    payload = {"estimated_wait_minutes": 67.2, "triage_level": "Standard"}
    raw = PredictionResponse(prediction=67.2, confidence=0.88)
    result = PredictionResult(intent=Intent.WAITING_TIME, is_available=True, payload=payload, raw_response=raw)
    reply = generator.generate_response(Intent.WAITING_TIME, prediction_result=result)

    assert reply == "The waiting-time model estimates approximately **67.2 minutes** for **Standard** triage, with an estimated confidence of 88%."


def test_high_demand_grounded_response():
    generator = ResponseGenerator()
    payload = {"is_high_demand_expected": True, "status": "ANOMALOUS SURGE DETECTED", "severity": "High"}
    raw = PredictionResponse(prediction=payload, confidence=0.92)
    result = PredictionResult(intent=Intent.HIGH_DEMAND_PERIOD, is_available=True, payload=payload, raw_response=raw)
    reply = generator.generate_response(Intent.HIGH_DEMAND_PERIOD, prediction_result=result)

    assert reply == "High Demand Alert: The high-demand model predicts **ANOMALOUS SURGE DETECTED** (High demand risk), with an estimated confidence of 92%."


def test_flow_pattern_grounded_response():
    generator = ResponseGenerator()
    payload = {"pattern_name": "Medium Demand", "cluster_id": 1}
    raw = PredictionResponse(prediction=payload, confidence=0.88)
    result = PredictionResult(intent=Intent.FLOW_PATTERN, is_available=True, payload=payload, raw_response=raw)
    reply = generator.generate_response(Intent.FLOW_PATTERN, prediction_result=result)

    assert reply == "The flow-pattern clustering model categorizes the current state as **Medium Demand** (Cluster #1), with an estimated confidence of 88%."
