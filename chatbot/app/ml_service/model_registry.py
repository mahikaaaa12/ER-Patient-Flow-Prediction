import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.ml_service.ml_interface import MLModelInterface

logger = logging.getLogger(__name__)


class ModelRegistry:
    """
    Central registry for storing, registering, retrieving, and inspecting health
    of real ML prediction models.
    """

    def __init__(self) -> None:
        self._models: Dict[str, Any] = {}
        self._load_errors: Dict[str, str] = {}
        self._unified_interface: Optional[MLModelInterface] = None

    def register_model(self, name: str, model_instance: Any) -> None:
        """
        Registers a validated ML model instance under a unique identifier name.
        """
        if not name or not isinstance(name, str):
            raise ValueError("Model name must be a non-empty string.")
        if model_instance is None:
            raise ValueError("Cannot register a None model instance.")

        clean_name = name.strip()
        self._models[clean_name] = model_instance
        self._load_errors.pop(clean_name, None)
        logger.info(f"Model successfully registered in ModelRegistry: '{clean_name}'")

    def record_load_error(self, name: str, error_msg: str) -> None:
        """Records an explicit loading failure reason for a model."""
        clean_name = name.strip()
        self._load_errors[clean_name] = error_msg
        logger.warning(f"Recorded load error for model '{clean_name}': {error_msg}")

    def get_model(self, name: str) -> Optional[Any]:
        """Retrieves a registered model by name. Returns None if not found or unavailable."""
        return self._models.get(name.strip()) if name else None

    def has_model(self, name: str) -> bool:
        """Checks if a model with the given name is registered."""
        return name.strip() in self._models if name else False

    def list_models(self) -> List[str]:
        """Returns a list of all currently registered model names."""
        return list(self._models.keys())

    def unregister_model(self, name: str) -> bool:
        """Removes a model from the registry."""
        clean_name = name.strip() if name else ""
        if clean_name in self._models:
            del self._models[clean_name]
            logger.info(f"Model '{clean_name}' unregistered from ModelRegistry.")
            return True
        return False

    def set_unified_interface(self, interface: MLModelInterface) -> None:
        """Sets a unified MLModelInterface implementation."""
        self._unified_interface = interface
        logger.info(f"Unified MLModelInterface set to: {interface.__class__.__name__}")

    def get_unified_interface(self) -> Optional[MLModelInterface]:
        """Retrieves the active unified MLModelInterface."""
        return self._unified_interface

    def get_model_health_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Exposes detailed health information for all expected trained ML models:
        - model_name
        - artifact_path
        - model_type
        - loaded_status ('loaded' | 'unavailable')
        - version
        - error_message
        """
        expected_models = [
            "patient_volume_model",
            "waiting_time_model",
            "crowding_model",
            "high_demand_model",
            "flow_pattern_model",
        ]
        status: Dict[str, Dict[str, Any]] = {}

        for name in expected_models:
            model = self._models.get(name)
            is_loaded = False
            if model is not None:
                if hasattr(model, "is_loaded"):
                    is_loaded = model.is_loaded()
                else:
                    is_loaded = True

            if model is not None and is_loaded:
                status[name] = {
                    "model_name": name,
                    "artifact_path": str(getattr(model, "artifact_path", "N/A")),
                    "model_type": str(getattr(model, "model_type", type(model).__name__)),
                    "loaded_status": "loaded",
                    "version": str(getattr(model, "model_version", "1.0.0")),
                    "error_message": None,
                }
            else:
                err_msg = self._load_errors.get(name, getattr(model, "load_error", "Model artifact not loaded or registered."))
                status[name] = {
                    "model_name": name,
                    "artifact_path": str(getattr(model, "artifact_path", "N/A")) if model else "N/A",
                    "model_type": str(getattr(model, "model_type", "N/A")) if model else "N/A",
                    "loaded_status": "unavailable",
                    "version": str(getattr(model, "model_version", "N/A")) if model else "N/A",
                    "error_message": err_msg,
                }

        return status

    def clear(self) -> None:
        """Clears all registered models and recorded errors."""
        self._models.clear()
        self._load_errors.clear()
        self._unified_interface = None


# Global registry singleton
model_registry = ModelRegistry()
