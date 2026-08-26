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
    forecast: ArrivalForecastResponse
    waiting_time: WaitingTimeResponse
    crowding_risk: CrowdingRiskResponse
    flow_pattern: FlowPatternResponse
    surge_detection: SurgeDetectionResponse
    ai_summary_text: str
