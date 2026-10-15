from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .supervised import WaitingTimeResponse, CrowdingRiskResponse
from .unsupervised import FlowPatternResponse, SurgeDetectionResponse
from .deep_learning import ArrivalForecastResponse


class AssistantQueryRequest(BaseModel):
    question: str
    hospital_state: Optional[Dict[str, Any]] = None


class AssistantInsightItem(BaseModel):
    label: str
    value: str
    icon: str
    tone: str


class AssistantQueryResponse(BaseModel):
    text: str
    insights: List[AssistantInsightItem]


class DashboardOverviewResponse(BaseModel):
    forecast: Optional[ArrivalForecastResponse] = None
    waiting_time: Optional[WaitingTimeResponse] = None
    crowding_risk: Optional[CrowdingRiskResponse] = None
    flow_pattern: Optional[FlowPatternResponse] = None
    surge_detection: Optional[SurgeDetectionResponse] = None
    ai_summary_text: str = ""
    request_id: Optional[str] = Field(None, description="Unique trace ID for inference request observability")
    execution_time_ms: Optional[float] = Field(None, description="Total backend inference time in milliseconds")
    engine_status: Optional[Dict[str, str]] = Field(None, description="Status for each of the 5 prediction engines")

