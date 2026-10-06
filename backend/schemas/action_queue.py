from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ActionStatus(str, Enum):
    NEW = "NEW"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    MONITORING = "MONITORING"
    COMPLETED = "COMPLETED"


class ActionItem(BaseModel):
    """Specific operational action item in the ED Command Action Queue."""
    id: str = Field(..., description="Unique action ID")
    category: str = Field(..., description="Operational category (e.g. BED CAPACITY, TRIAGE CAPACITY, STAFFING)")
    title: str = Field(..., description="Action title")
    recommendation: str = Field(..., description="Recommended operational action details")
    priority: str = Field(..., description="CRITICAL | HIGH | MODERATE | LOW")
    created_at: str = Field(..., description="ISO 8601 timestamp when action was created")
    due_time: str = Field(..., description="Target time window or deadline for operational attention")
    status: ActionStatus = Field(default=ActionStatus.NEW, description="NEW | ACKNOWLEDGED | MONITORING | COMPLETED")
    contributing_factors: List[str] = Field(default_factory=list, description="Key operational telemetry and ML factors")
    source_prediction: str = Field(..., description="Underlying ML model or derivation engine source")
    urgency: Optional[str] = Field(default="WITHIN 30 MIN", description="Operational urgency level")
    reason: Optional[str] = Field(default=None, description="Analytical justification")
    explanation_detail: Optional[Dict[str, Any]] = Field(default=None, description="Structured 6-question XAI breakdown")


class ActionSummary(BaseModel):
    """Operational summary metrics for active action queue."""
    open_actions: int = Field(..., description="Total open/active actions (NEW + ACKNOWLEDGED + MONITORING)")
    high_priority: int = Field(..., description="Total actions with HIGH or CRITICAL priority")
    completed: int = Field(..., description="Total completed actions")
    total_actions: int = Field(..., description="Total actions in queue")


class UpdateActionStatusRequest(BaseModel):
    """Payload for updating action queue item status."""
    status: ActionStatus = Field(..., description="Target status: NEW | ACKNOWLEDGED | MONITORING | COMPLETED")


class ActionQueueResponse(BaseModel):
    """Response payload for ED Command Action Queue."""
    summary: ActionSummary
    actions: List[ActionItem]
    filter_applied: str = Field("ALL", description="Filter applied: ALL | HIGH PRIORITY | NEW | ACKNOWLEDGED | COMPLETED")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    safety_disclaimer: str = Field(
        "OPERATIONAL TASK SYSTEM ONLY: Manage department-level workflow tasks. Does NOT modify patient medical records or create patient-specific treatment actions.",
        description="Mandatory clinical safety disclaimer"
    )
