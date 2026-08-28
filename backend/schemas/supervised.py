from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from .hospital_state import HospitalState


class WaitingTimeResponse(BaseModel):
    waiting_time_minutes: float = Field(description="Predicted average waiting time in minutes")
    predicted_1h: float = Field(description="Projected wait time in next hour")
    predicted_peak: float = Field(description="Projected peak wait time during shift")
    trend: str = Field(description="Trend direction (Increasing, Stable, Decreasing)")
    model_name: str = Field(default="XGBoost Regressor")
    explanation: Optional[Dict[str, Any]] = Field(default=None, description="TreeSHAP model explanation")


class CrowdingRiskResponse(BaseModel):
    crowding_level: str = Field(description="Low, Moderate, High, Critical")
    crowding_score: int = Field(description="Normalized 0-100 crowding index score")
    probabilities: Dict[str, float] = Field(description="Probability distribution across classes")
    model_name: str = Field(default="XGBoost Classifier")
    expected_window: Optional[str] = Field(default="Next 3 Hours")
    explanation: Optional[Dict[str, Any]] = Field(default=None, description="TreeSHAP model explanation")


class SupervisedPredictionResponse(BaseModel):
    waiting_time: WaitingTimeResponse
    crowding_risk: CrowdingRiskResponse
