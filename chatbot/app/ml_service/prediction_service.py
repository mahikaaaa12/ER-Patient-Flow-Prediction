import logging
from typing import Any, Dict, Optional
from app.core.config import settings
from app.ml_service.mock_models import dev_mock_provider
from app.ml_service.model_registry import ModelRegistry, model_registry
from app.schemas.prediction_schema import (
    Intent,
    PredictionInputData,
    PredictionRequest,
    PredictionResponse,
    PredictionResult,
)

logger = logging.getLogger(__name__)


class PredictionService:
    """
    Service layer coordinating prediction queries between the Chatbot and registered ML models.
    Supports switching between real model registry and development-only mock provider.
    """

    MODEL_UNAVAILABLE_MSG = "The prediction model is currently unavailable."

    def __init__(self, registry: Optional[ModelRegistry] = None, use_mock_mode: Optional[bool] = None) -> None:
        self.registry = registry or model_registry
        self._use_mock_mode = use_mock_mode

    @property
    def is_mock_mode(self) -> bool:
        """Determines if mock mode is active."""
        if self._use_mock_mode is not None:
            return self._use_mock_mode
        return settings.USE_MOCK_MODE or settings.USE_MOCK_MODELS

    def _create_unavailable_response(self, model_name: str, reason: Optional[str] = None) -> PredictionResponse:
        """Constructs a standardized unavailable PredictionResponse."""
        msg = reason or self.MODEL_UNAVAILABLE_MSG
        return PredictionResponse(
            is_available=False,
            prediction=None,
            model_name=model_name,
            error_message=msg,
        )

    def predict_patient_volume(self, input_data: PredictionInputData) -> PredictionResponse:
        """Executes patient volume prediction via mock provider or real model registry."""
        if self.is_mock_mode:
            logger.info("Executing patient volume in DEVELOPMENT MOCK mode.")
            return dev_mock_provider.predict_patient_volume(input_data)

        unified = self.registry.get_unified_interface()
        model = self.registry.get_model("patient_volume_model") or self.registry.get_model("volume_model")

        if unified is not None:
            try:
                return unified.predict_patient_volume(input_data)
            except Exception as e:
                logger.error(f"Error executing unified predict_patient_volume: {e}", exc_info=True)
                return self._create_unavailable_response("unified_model", str(e))

        if model is not None and hasattr(model, "predict_patient_volume"):
            try:
                return model.predict_patient_volume(input_data)
            except Exception as e:
                logger.error(f"Error executing predict_patient_volume on registered model: {e}", exc_info=True)
                return self._create_unavailable_response("patient_volume_model", str(e))

        return self._create_unavailable_response("patient_volume_model")

    def predict_waiting_time(self, input_data: PredictionInputData) -> PredictionResponse:
        """Executes waiting time prediction via mock provider or real model registry."""
        if self.is_mock_mode:
            logger.info("Executing waiting time in DEVELOPMENT MOCK mode.")
            return dev_mock_provider.predict_waiting_time(input_data)

        unified = self.registry.get_unified_interface()
        model = self.registry.get_model("waiting_time_model") or self.registry.get_model("wait_time_model")

        if unified is not None:
            try:
                return unified.predict_waiting_time(input_data)
            except Exception as e:
                logger.error(f"Error executing unified predict_waiting_time: {e}", exc_info=True)
                return self._create_unavailable_response("unified_model", str(e))

        if model is not None and hasattr(model, "predict_waiting_time"):
            try:
                return model.predict_waiting_time(input_data)
            except Exception as e:
                logger.error(f"Error executing predict_waiting_time on registered model: {e}", exc_info=True)
                return self._create_unavailable_response("waiting_time_model", str(e))

        return self._create_unavailable_response("waiting_time_model")

    def predict_crowding(self, input_data: PredictionInputData) -> PredictionResponse:
        """Executes crowding prediction via mock provider or real model registry."""
        if self.is_mock_mode:
            logger.info("Executing crowding in DEVELOPMENT MOCK mode.")
            return dev_mock_provider.predict_crowding(input_data)

        unified = self.registry.get_unified_interface()
        model = self.registry.get_model("crowding_model") or self.registry.get_model("ed_crowding_model")

        if unified is not None:
            try:
                return unified.predict_crowding(input_data)
            except Exception as e:
                logger.error(f"Error executing unified predict_crowding: {e}", exc_info=True)
                return self._create_unavailable_response("unified_model", str(e))

        if model is not None and hasattr(model, "predict_crowding"):
            try:
                return model.predict_crowding(input_data)
            except Exception as e:
                logger.error(f"Error executing predict_crowding on registered model: {e}", exc_info=True)
                return self._create_unavailable_response("crowding_model", str(e))

        return self._create_unavailable_response("crowding_model")

    def predict_high_demand_period(self, input_data: PredictionInputData) -> PredictionResponse:
        """Executes high-demand period prediction via mock provider or real model registry."""
        if self.is_mock_mode:
            logger.info("Executing high-demand in DEVELOPMENT MOCK mode.")
            return dev_mock_provider.predict_high_demand_period(input_data)

        unified = self.registry.get_unified_interface()
        model = self.registry.get_model("high_demand_model") or self.registry.get_model("surge_model")

        if unified is not None and hasattr(unified, "predict_high_demand_period"):
            try:
                return unified.predict_high_demand_period(input_data)
            except Exception as e:
                logger.error(f"Error executing unified predict_high_demand_period: {e}", exc_info=True)
                return self._create_unavailable_response("unified_model", str(e))

        if model is not None and hasattr(model, "predict_high_demand_period"):
            try:
                return model.predict_high_demand_period(input_data)
            except Exception as e:
                logger.error(f"Error executing predict_high_demand_period on registered model: {e}", exc_info=True)
                return self._create_unavailable_response("high_demand_model", str(e))

        return self._create_unavailable_response("high_demand_model")

    def predict_flow_pattern(self, input_data: PredictionInputData) -> PredictionResponse:
        """Executes unsupervised flow pattern clustering via real model registry."""
        if self.is_mock_mode:
            logger.info("Executing flow pattern in DEVELOPMENT MOCK mode.")
            return PredictionResponse(
                prediction={"cluster_id": 1, "pattern_name": "Medium Demand", "current_point": {"x": 0.0, "y": 0.0}},
                is_mock=True,
                model_name="mock_flow_pattern",
            )

        model = self.registry.get_model("flow_pattern_model")
        if model is not None and hasattr(model, "predict_flow_pattern"):
            try:
                return model.predict_flow_pattern(input_data)
            except Exception as e:
                logger.error(f"Error executing predict_flow_pattern on registered model: {e}", exc_info=True)
                return self._create_unavailable_response("flow_pattern_model", str(e))

        return self._create_unavailable_response("flow_pattern_model")

    def get_prediction(self, request: PredictionRequest) -> PredictionResult:
        """
        Dispatches incoming Chatbot prediction requests based on detected Intent.
        Converts the PredictionResponse to a PredictionResult container for the Chatbot.
        """
        intent = request.intent
        input_data = request.input_data or PredictionInputData(
            features=request.parameters,
            triage_level=request.parameters.get("triage_level"),
            time_window=request.parameters.get("time_window"),
            historical_patient_count=request.parameters.get("historical_patient_count"),
        )

        response: PredictionResponse

        if intent == Intent.PATIENT_VOLUME:
            response = self.predict_patient_volume(input_data)
        elif intent == Intent.WAITING_TIME:
            response = self.predict_waiting_time(input_data)
        elif intent == Intent.CROWDING:
            response = self.predict_crowding(input_data)
        elif intent == Intent.HIGH_DEMAND_PERIOD:
            response = self.predict_high_demand_period(input_data)
        elif intent == Intent.FLOW_PATTERN:
            response = self.predict_flow_pattern(input_data)
        elif intent == Intent.GENERAL_STATUS:
            if self.is_mock_mode:
                response = PredictionResponse(
                    prediction=None,
                    is_mock=True,
                    model_name="mock_general_status_engine",
                    model_version="0.0.0-mock",
                    metadata={"is_mock": True, "notice": "DEVELOPMENT TEST RESULT ONLY"},
                )
            else:
                vol_res = self.predict_patient_volume(input_data)
                wait_res = self.predict_waiting_time(input_data)
                crowd_res = self.predict_crowding(input_data)
                surge_res = self.predict_high_demand_period(input_data)

                if any([vol_res.is_available, wait_res.is_available, crowd_res.is_available, surge_res.is_available]):
                    summary_payload = {}
                    if vol_res.is_available and vol_res.prediction:
                        summary_payload["volume"] = vol_res.prediction
                    if wait_res.is_available and wait_res.prediction:
                        summary_payload["waiting_time"] = wait_res.prediction
                    if crowd_res.is_available and crowd_res.prediction:
                        summary_payload["crowding"] = crowd_res.prediction
                    if surge_res.is_available and surge_res.prediction:
                        summary_payload["surge"] = surge_res.prediction

                    response = PredictionResponse(
                        prediction=summary_payload,
                        confidence=0.90,
                        model_name="general_status_aggregator",
                        model_version="1.0.0",
                        is_available=True,
                    )
                else:
                    response = self._create_unavailable_response("general_status_engine")
        else:
            return PredictionResult(
                intent=intent,
                is_available=False,
                payload=None,
                error_message="No ML prediction required for this intent.",
            )

        # Handle Mock Mode results
        if response.is_mock:
            mock_payload = {
                "is_mock": True,
                "model_name": response.model_name,
                "prediction": response.prediction,
                "notice": "DEVELOPMENT TEST RESULT ONLY - NOT A REAL PREDICTION",
            }
            if response.metadata:
                mock_payload.update(response.metadata)

            return PredictionResult(
                intent=intent,
                is_available=True,
                is_mock=True,
                payload=mock_payload,
                model_name=response.model_name,
                raw_response=response,
                metadata=response.metadata,
            )

        if not response.is_available or response.prediction is None:
            return PredictionResult(
                intent=intent,
                is_available=False,
                is_mock=False,
                payload=None,
                model_name=response.model_name,
                error_message=response.error_message or self.MODEL_UNAVAILABLE_MSG,
                raw_response=response,
            )

        # Convert real model prediction to dict payload
        payload = response.prediction if isinstance(response.prediction, dict) else {"predicted_value": response.prediction}
        if response.metadata:
            payload.update(response.metadata)

        return PredictionResult(
            intent=intent,
            is_available=True,
            is_mock=False,
            payload=payload,
            model_name=response.model_name,
            raw_response=response,
        )


# Global singleton instance
prediction_service = PredictionService()
