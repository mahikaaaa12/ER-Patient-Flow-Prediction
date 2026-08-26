from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class Intent(str, Enum):
    GREETING = "GREETING"
    HELP = "HELP"
    PATIENT_VOLUME = "PATIENT_VOLUME"
    WAITING_TIME = "WAITING_TIME"
    CROWDING = "CROWDING"
    HIGH_DEMAND_PERIOD = "HIGH_DEMAND_PERIOD"
    FLOW_PATTERN = "FLOW_PATTERN"
    GENERAL_STATUS = "GENERAL_STATUS"
    MODEL_INFO = "MODEL_INFO"
    PROJECT_INFO = "PROJECT_INFO"
    OUT_OF_SCOPE_MEDICAL = "OUT_OF_SCOPE_MEDICAL"
    UNKNOWN = "UNKNOWN"


IntentEnum = Intent


class PredictionType(str, Enum):
    PATIENT_VOLUME = "PATIENT_VOLUME"
    WAITING_TIME = "WAITING_TIME"
    CROWDING = "CROWDING"
    HIGH_DEMAND_PERIOD = "HIGH_DEMAND_PERIOD"
    FLOW_PATTERN = "FLOW_PATTERN"
    GENERAL_STATUS = "GENERAL_STATUS"


class PredictionInputData(BaseModel):
    """
    Extensible input schema for ER ML prediction models.
    Supports standard temporal features while allowing arbitrary custom features.
    """
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Prediction reference timestamp")
    day_of_week: Optional[str] = Field(default=None, description="Day of week (e.g. Monday, 0-6)")
    historical_patient_count: Optional[int] = Field(default=None, description="Recent historical ER patient count")
    triage_level: Optional[str] = Field(default=None, description="Triage severity category (for wait time models)")
    time_window: Optional[str] = Field(default=None, description="Forecast window (e.g. 'next_4_hours', 'today')")
    features: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary feature dictionary for model inputs")

    model_config = ConfigDict(extra="allow")


class PredictionResponse(BaseModel):
    """
    Standardized response schema returned by ML prediction models or mock providers.
    """
    prediction: Any = Field(default=None, description="Predicted value or test result")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Confidence score")
    model_name: Optional[str] = Field(default=None, description="Name of the model generating this prediction")
    model_version: Optional[str] = Field(default=None, description="Version of the model artifact")
    is_mock: bool = Field(default=False, description="Explicit flag indicating if this is a development mock result")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Execution timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional model output metrics or context")
    is_available: bool = Field(default=True, description="Indicates if model was available and executed")
    error_message: Optional[str] = Field(default=None, description="Reason if model was unavailable or errored")

    model_config = ConfigDict(extra="allow")


class PredictionRequest(BaseModel):
    intent: Intent
    input_data: Optional[PredictionInputData] = None
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Legacy parameter dictionary")

    model_config = ConfigDict(extra="allow")


class PredictionResult(BaseModel):
    """
    Coordinator container bridging PredictionResponse to the Chatbot service layer.
    """
    intent: Intent
    is_available: bool = Field(default=False, description="True if a prediction was computed or mock executed")
    is_mock: bool = Field(default=False, description="Flag indicating if this is from development mock mode")
    payload: Optional[Dict[str, Any]] = Field(default=None, description="Structured prediction payload")
    model_name: Optional[str] = Field(default=None, description="Identifier of the model used")
    error_message: Optional[str] = Field(default=None, description="Error message if model is unavailable")
    raw_response: Optional[PredictionResponse] = Field(default=None, description="Underlying PredictionResponse object")
    metadata: Dict[str, Any] = Field(default_factory=dict)
