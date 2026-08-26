import pytest
from app.chatbot.input_validator import InputValidator
from app.schemas.prediction_schema import Intent


def test_input_validator_valid_features():
    validator = InputValidator()
    context = {
        "features": {
            "hour_of_day": 14,
            "day_of_week": 2,
            "month": 8,
            "arrival_rate": 35.0,
            "occupancy_percent": 85.0,
            "available_beds": 10,
        },
        "triage_level": "Standard",
    }
    result = validator.validate_prediction_input(Intent.WAITING_TIME, context)
    assert result.is_valid is True
    assert result.validated_input is not None
    assert result.validated_input.features["hour_of_day"] == 14
    assert result.validated_input.triage_level == "Standard"


def test_input_validator_invalid_hour_boundary():
    validator = InputValidator()
    context = {"features": {"hour_of_day": 25}}
    result = validator.validate_prediction_input(Intent.CROWDING, context)
    assert result.is_valid is False
    assert "hour_of_day (25) must be an integer between 0 and 23" in result.error_message


def test_input_validator_invalid_occupancy_boundary():
    validator = InputValidator()
    context = {"features": {"occupancy_percent": 150.0}}
    result = validator.validate_prediction_input(Intent.CROWDING, context)
    assert result.is_valid is False
    assert "occupancy_percent (150.0) must be between 0.0% and 100.0%" in result.error_message


def test_input_validator_invalid_triage_level():
    validator = InputValidator()
    context = {"triage_level": "SuperInvalidTriage"}
    result = validator.validate_prediction_input(Intent.WAITING_TIME, context)
    assert result.is_valid is False
    assert "triage_level 'SuperInvalidTriage' is invalid" in result.error_message


def test_input_validator_clarification_request():
    validator = InputValidator()
    context = {"requires_explicit_datetime": True}
    result = validator.validate_prediction_input(Intent.CROWDING, context)
    assert result.is_valid is False
    assert result.clarification_message == "Sure. What date and time would you like me to check?"
