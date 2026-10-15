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
    response_option: Optional[str] = Field(default=None, description="Selected response option for acknowledgement")
    notes: Optional[str] = Field(default=None, description="Optional acknowledgement notes")
    acknowledged_at: Optional[str] = Field(default=None, description="ISO timestamp when acknowledged")
    contributing_factors: List[str] = Field(default_factory=list, description="Key operational telemetry and ML factors")
    source_prediction: str = Field(..., description="Underlying ML model or derivation engine source")
    urgency: Optional[str] = Field(default="WITHIN 30 MIN", description="Operational urgency level")
    reason: Optional[str] = Field(default=None, description="Analytical justification")
    explanation_detail: Optional[Dict[str, Any]] = Field(default=None, description="Structured 6-question XAI breakdown")
    priority_score: Optional[float] = Field(default=None, description="0-100 deterministic rule-based priority score")
    model_confidence: Optional[float] = Field(default=None, description="Native ML model confidence probability")
    issue_trend: Optional[str] = Field(default="NEW", description="NEW | ESCALATING | DE-ESCALATING | STABLE | RECOVERY_PENDING | RECURRENCE")
    escalation_detected: bool = Field(default=False, description="Flag indicating severity increase")
    requires_human_confirmation_to_resolve: bool = Field(default=True, description="Safety guard preventing premature resolution")
    historical_occurrence_count: int = Field(default=1, description="Number of times this issue identity has occurred")
    audit_history: List[Dict[str, Any]] = Field(default_factory=list, description="Historical audit trail of user actions and underlying condition changes")
    condition_changed_since_ack: bool = Field(default=False, description="Flag indicating if underlying issue changed after acknowledgement")
    condition_change_summary: Optional[str] = Field(default=None, description="Summary of what changed in the underlying issue after acknowledgement")
    resolved_at: Optional[str] = Field(default=None, description="ISO timestamp when marked resolved")
    resolution_notes: Optional[str] = Field(default=None, description="Clinical or operational notes explaining the resolution")
    resolved_by: Optional[str] = Field(default=None, description="User identity or role that marked the item resolved")
    acknowledged_by: Optional[str] = Field(default=None, description="User identity or role that acknowledged the item")


class ActionSummary(BaseModel):
    """Operational summary metrics for active action queue."""
    open_actions: int = Field(..., description="Total open/active actions (NEW + ACKNOWLEDGED + MONITORING)")
    high_priority: int = Field(..., description="Total actions with HIGH or CRITICAL priority")
    completed: int = Field(..., description="Total completed actions")
    total_actions: int = Field(..., description="Total actions in queue")


class UpdateActionStatusRequest(BaseModel):
    """Payload for updating action queue item status."""
    status: ActionStatus = Field(..., description="Target status: NEW | ACKNOWLEDGED | MONITORING | COMPLETED")
    response_option: Optional[str] = Field(default=None, description="Selected response option for acknowledgement")
    notes: Optional[str] = Field(default=None, description="Optional acknowledgement notes")
    acknowledged_at: Optional[str] = Field(default=None, description="ISO timestamp when acknowledged")
    acknowledged_by: Optional[str] = Field(default=None, description="User identity or role that acknowledged the item")
    resolved_at: Optional[str] = Field(default=None, description="ISO timestamp when marked resolved")
    resolution_notes: Optional[str] = Field(default=None, description="Clinical or operational notes explaining the resolution")
    resolved_by: Optional[str] = Field(default=None, description="User identity or role that marked the item resolved")
    title: Optional[str] = Field(default=None, description="Optional title override")
    category: Optional[str] = Field(default=None, description="Optional category override")
    recommendation: Optional[str] = Field(default=None, description="Optional recommendation override")
    priority: Optional[str] = Field(default=None, description="Optional priority override")


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
