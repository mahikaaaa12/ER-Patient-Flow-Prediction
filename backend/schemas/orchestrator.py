from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class WorkloadFactor(BaseModel):
    """Specific factor contributing to operational strain or recommendations."""
    name: str = Field(..., description="Name of the operational or ML feature factor")
    impact: str = Field(..., description="increases_pressure | decreases_pressure | neutral")
    contribution_score: float = Field(..., description="Relative contribution magnitude or percentage")
    detail: str = Field(..., description="Human-readable description of factor impact")


class OperationalIssue(BaseModel):
    """Prioritized operational issue requiring administrative attention."""
    id: str = Field(..., description="Unique issue identifier")
    category: str = Field(
        ...,
        description="TRIAGE CAPACITY | BED CAPACITY | STAFFING | ARRIVAL PRESSURE | WAITING QUEUE | CROWDING | SURGE | FLOW"
    )
    severity: str = Field(..., description="CRITICAL | HIGH | MODERATE | LOW")
    title: str = Field(..., description="Concise summary title of the operational issue")
    description: str = Field(..., description="Detailed operational context and risk rationale")
    affected_metrics: List[str] = Field(default_factory=list, description="Key operational metrics affected")


class ExplanationDetail(BaseModel):
    """Structured XAI explanation answering the 6 core operational questions."""
    detection_rationale: str = Field(..., description="1. Why was this issue detected?")
    contributing_factors: List[WorkloadFactor] = Field(default_factory=list, description="2. Which factors contributed?")
    strongest_influencer: str = Field(..., description="3. Which factor has the strongest influence?")
    triggering_prediction: str = Field(..., description="4. What prediction triggered the recommendation?")
    expected_operational_condition: str = Field(..., description="5. What operational condition is expected?")
    staff_review_guidance: str = Field(..., description="6. What should the staff review?")
    disclaimer: str = Field(
        "Non-causal model attribution: Feature attributions indicate statistical associations in department telemetry and do not imply direct clinical causality.",
        description="Safety disclaimer for non-causal XAI interpretation"
    )


class RecommendationAction(BaseModel):
    """Actionable departmental recommendation for ER command staff."""
    id: str = Field(..., description="Unique recommendation identifier")
    category: str = Field(
        ...,
        description="TRIAGE CAPACITY | BED CAPACITY | STAFFING | ARRIVAL PRESSURE | WAITING QUEUE | CROWDING | SURGE | FLOW"
    )
    priority: str = Field(..., description="CRITICAL | HIGH | MODERATE | LOW")
    title: str = Field(..., description="Title of the recommended action")
    description: str = Field(..., description="Operational diagnosis and contextual justification")
    recommended_action: str = Field(..., description="Department-level resource management recommendation")
    urgency: str = Field(..., description="IMMEDIATE | WITHIN 30 MIN | WITHIN 1 HOUR | NEXT SHIFT")
    due_in_minutes: int = Field(..., description="Estimated time window in minutes before attention required")
    contributing_factors: List[WorkloadFactor] = Field(default_factory=list, description="Factors driving this recommendation")
    reason: str = Field(..., description="Analytical explanation for why action is suggested")
    confidence: str = Field(..., description="HIGH | MEDIUM | LOW | LOW (DEGRADED)")
    explanation_detail: ExplanationDetail = Field(..., description="Structured 6-question XAI breakdown")
    requires_human_review: bool = Field(
        True,
        description="Mandatory safety gate indicating recommendation must be reviewed by ER command staff"
    )


class WorkloadAssessment(BaseModel):
    """Departmental workload and staffing ratio assessment."""
    doctor_load_ratio: float = Field(..., description="Patients waiting per active physician")
    nurse_load_ratio: float = Field(..., description="Total active load (waiting + occupied beds) per nurse")
    bed_occupancy_percent: float = Field(..., description="Current bed occupancy percentage")
    current_workload_level: str = Field(..., description="LOW | MODERATE | HIGH | CRITICAL")
    upcoming_3h_workload_level: str = Field(..., description="LOW | MODERATE | HIGH | CRITICAL")
    summary: str = Field(..., description="High-level narrative of current department workload state")


class OrchestratorRequest(BaseModel):
    """Request payload for ED Command & Workload Orchestrator."""
    hospital_state: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional snapshot of operational variables. Uses default ER state if omitted."
    )


class OrchestratorResponse(BaseModel):
    """Response payload for ED Command & Workload Orchestrator."""
    overall_pressure_score: float = Field(..., ge=0.0, le=100.0, description="Composite ER pressure index (0-100)")
    pressure_level: str = Field(..., description="LOW | MODERATE | HIGH | CRITICAL")
    workload_assessment: WorkloadAssessment
    prioritized_issues: List[OperationalIssue]
    recommended_actions: List[RecommendationAction]
    ml_engine_status: Dict[str, str] = Field(..., description="Status of underlying ML prediction engines")
    degraded_mode: bool = Field(..., description="True if any ML engine was unavailable and fallback heuristics were used")
    data_sources_used: List[str] = Field(default_factory=list, description="List of ML models and telemetry feeds consumed")
    request_id: Optional[str] = Field(None, description="Observability trace ID")
    timestamp: str = Field(..., description="ISO 8601 timestamp of analysis execution")
    safety_disclaimer: str = Field(
        "OPERATIONAL DECISION SUPPORT ONLY: This system provides department-level resource and workload orchestration guidance. It does NOT make clinical diagnosis, treatment, or individual patient triage decisions.",
        description="Mandatory clinical safety policy banner"
    )
