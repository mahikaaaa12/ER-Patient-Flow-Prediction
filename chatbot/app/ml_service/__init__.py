"""
ML Service Package: Interfaces, Model Registry, Prediction Service, Adapters, and Dev Mock Provider.
"""

from .ml_interface import (
    BaseMLModel,
    CrowdingPredictor,
    HighDemandPredictor,
    MLModelInterface,
    ModelNotAvailableError,
    PatientVolumePredictor,
    WaitingTimePredictor,
)
from .mock_models import (
    MockCrowdingProvider,
    MockHighDemandProvider,
    MockMLProvider,
    MockPatientVolumeProvider,
    MockWaitingTimeProvider,
    dev_mock_provider,
)
from .model_adapters import (
    BaseModelAdapter,
    CrowdingModelAdapter,
    HighDemandModelAdapter,
    PatientVolumeModelAdapter,
    WaitingTimeModelAdapter,
)
from .model_registry import ModelRegistry, model_registry
from .prediction_service import PredictionService, prediction_service

__all__ = [
    "BaseMLModel",
    "MLModelInterface",
    "PatientVolumePredictor",
    "WaitingTimePredictor",
    "CrowdingPredictor",
    "HighDemandPredictor",
    "ModelNotAvailableError",
    "ModelRegistry",
    "model_registry",
    "PredictionService",
    "prediction_service",
    "BaseModelAdapter",
    "PatientVolumeModelAdapter",
    "WaitingTimeModelAdapter",
    "CrowdingModelAdapter",
    "HighDemandModelAdapter",
    "MockMLProvider",
    "dev_mock_provider",
    "MockPatientVolumeProvider",
    "MockWaitingTimeProvider",
    "MockCrowdingProvider",
    "MockHighDemandProvider",
]
