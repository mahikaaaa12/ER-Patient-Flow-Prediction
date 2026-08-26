"""
DEVELOPMENT-ONLY MOCK ML PROVIDER
=================================
IMPORTANT NOTICE:
-----------------
These mock classes are for DEVELOPMENT, TESTING, and CI/CD PIPELINE VERIFICATION ONLY.
They are NOT trained ML models and do NOT compute real medical or clinical forecasts.
They must NEVER be presented to users as genuine emergency room predictions.

Purpose:
--------
Validates the end-to-end integration flow:
  Chatbot → Intent Detection → Prediction Service → ML Interface → Response Generator
"""

from typing import Any, Dict
from app.ml_service.ml_interface import (
    CrowdingPredictor,
    HighDemandPredictor,
    MLModelInterface,
    PatientVolumePredictor,
    WaitingTimePredictor,
)
from app.schemas.prediction_schema import (
    PredictionInputData,
    PredictionResponse,
)


class MockPatientVolumeProvider(PatientVolumePredictor):
    """Development mock provider for patient volume pipeline testing."""

    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction=None,
            confidence=0.0,
            model_name="mock_patient_volume_model",
            model_version="0.0.0-mock",
            is_mock=True,
            metadata={
                "is_mock": True,
                "provider": "development_mock_provider",
                "notice": "DEVELOPMENT TEST RESULT ONLY - NOT A REAL PREDICTION",
                "time_window": input_data.time_window or "unspecified",
            },
        )


class MockWaitingTimeProvider(WaitingTimePredictor):
    """Development mock provider for waiting time pipeline testing."""

    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction=None,
            confidence=0.0,
            model_name="mock_waiting_time_model",
            model_version="0.0.0-mock",
            is_mock=True,
            metadata={
                "is_mock": True,
                "provider": "development_mock_provider",
                "notice": "DEVELOPMENT TEST RESULT ONLY - NOT A REAL PREDICTION",
                "triage_level": input_data.triage_level or "Standard",
            },
        )


class MockCrowdingProvider(CrowdingPredictor):
    """Development mock provider for ED crowding pipeline testing."""

    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction=None,
            confidence=0.0,
            model_name="mock_crowding_model",
            model_version="0.0.0-mock",
            is_mock=True,
            metadata={
                "is_mock": True,
                "provider": "development_mock_provider",
                "notice": "DEVELOPMENT TEST RESULT ONLY - NOT A REAL PREDICTION",
            },
        )


class MockHighDemandProvider(HighDemandPredictor):
    """Development mock provider for high-demand surge pipeline testing."""

    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        return PredictionResponse(
            prediction=None,
            confidence=0.0,
            model_name="mock_high_demand_model",
            model_version="0.0.0-mock",
            is_mock=True,
            metadata={
                "is_mock": True,
                "provider": "development_mock_provider",
                "notice": "DEVELOPMENT TEST RESULT ONLY - NOT A REAL PREDICTION",
            },
        )


class MockMLProvider(
    MLModelInterface,
    PatientVolumePredictor,
    WaitingTimePredictor,
    CrowdingPredictor,
    HighDemandPredictor,
):
    """
    Unified development-only mock provider implementing all prediction contracts.
    Used when USE_MOCK_MODE=true for testing the architecture without ML models.
    """

    def __init__(self) -> None:
        self.volume_provider = MockPatientVolumeProvider()
        self.wait_time_provider = MockWaitingTimeProvider()
        self.crowding_provider = MockCrowdingProvider()
        self.high_demand_provider = MockHighDemandProvider()

    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        return self.volume_provider.predict_patient_volume(input_data)

    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        return self.wait_time_provider.predict_waiting_time(input_data)

    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        return self.crowding_provider.predict_crowding(input_data)

    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        return self.high_demand_provider.predict_high_demand_period(input_data)


# Global singleton mock provider instance
dev_mock_provider = MockMLProvider()
