from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from app.schemas.prediction_schema import (
    PredictionInputData,
    PredictionResponse,
)


class ModelNotAvailableError(Exception):
    """Raised when a requested ML model is not registered, not loaded, or unavailable."""
    pass


class BaseMLModel(ABC):
    """
    Abstract Base Class for an individual ML model artifact (e.g. XGBoost, PyTorch, Scikit-learn, ONNX).
    Concrete model wrappers should inherit from this class.
    """

    def __init__(self, model_name: str, model_version: str = "1.0.0") -> None:
        self.model_name = model_name
        self.model_version = model_version

    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if model artifact weights are successfully loaded into memory."""
        pass

    @abstractmethod
    def predict(self, input_features: Dict[str, Any]) -> Any:
        """Execute raw model inference."""
        pass


class MLModelInterface(ABC):
    """
    Unified abstract interface contract for Emergency Room Patient Flow Predictions.
    Future trained ML models or model pipelines must implement these methods.
    """

    @abstractmethod
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        """
        Predict emergency room patient volume/arrivals for a specified period.

        Args:
            input_data: Standardized input containing timestamp, day_of_week, historical counts, etc.

        Returns:
            PredictionResponse containing predicted volume, confidence, model metadata.
        """
        pass

    @abstractmethod
    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        """
        Predict expected patient waiting time by triage acuity level.

        Args:
            input_data: Standardized input containing triage_level, current load, etc.

        Returns:
            PredictionResponse containing estimated wait minutes, confidence, model metadata.
        """
        pass

    @abstractmethod
    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        """
        Predict emergency department crowding metrics and occupancy status.

        Args:
            input_data: Standardized input containing active beds, current occupancy, etc.

        Returns:
            PredictionResponse containing crowding level/occupancy rate, model metadata.
        """
        pass

    @abstractmethod
    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        """
        Predict whether an upcoming window is a high-demand/surge period.

        Args:
            input_data: Standardized input containing forecast window, historical trends, etc.

        Returns:
            PredictionResponse containing surge flag, peak times, risk assessment.
        """
        pass


# Specialized interfaces for standalone single-purpose models
class PatientVolumePredictor(ABC):
    @abstractmethod
    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        pass


class WaitingTimePredictor(ABC):
    @abstractmethod
    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        pass


class CrowdingPredictor(ABC):
    @abstractmethod
    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        pass


class HighDemandPredictor(ABC):
    @abstractmethod
    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        pass
