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
    severity: Optional[str] = Field(None, description="Severity level corresponding to the detected pattern")
    title: str = Field(..., description="Title of the recommended action")
    description: str = Field(..., description="Operational diagnosis and contextual justification")
    recommended_action: str = Field(..., description="Primary departmental resource management recommendation")
    recommended_actions: List[str] = Field(default_factory=list, description="Multiple operational actions tailored to the pattern")
    contributing_metrics: Dict[str, Any] = Field(default_factory=dict, description="Key operational telemetry and ML metrics with actual observed values")
    urgency: str = Field(..., description="IMMEDIATE | WITHIN 30 MIN | WITHIN 1 HOUR | NEXT SHIFT")
    due_in_minutes: int = Field(..., description="Estimated time window in minutes before attention required")
    contributing_factors: List[WorkloadFactor] = Field(default_factory=list, description="Factors driving this recommendation")
    reason: str = Field(..., description="Analytical explanation for why action is suggested")
    rule_id: Optional[str] = Field(None, description="Identifier of the operational rule that produced this recommendation")
    rule_explanation: Optional[str] = Field(None, description="Detailed explanation of the rule condition that triggered this recommendation")
    forecast_horizon: Optional[str] = Field(None, description="Relevant forecasting window if applicable (e.g. 3h, 6h, 24h)")
    required_resources: List[str] = Field(default_factory=list, description="Department resources required to execute this intervention")
    required_approvals: List[str] = Field(default_factory=list, description="Clinical or operational authorizations required before action")
    action_status: Optional[str] = Field(default="NEW", description="Current workflow state: NEW | ACKNOWLEDGED | MONITORING | COMPLETED")
    contributing_models: List[str] = Field(default_factory=list, description="ML models that directly contributed to this recommendation")
    contributing_fields: List[str] = Field(default_factory=list, description="Telemetry and prediction fields that contributed")
    source_prediction: Optional[str] = Field(None, description="Primary source model or telemetry signal that initiated this recommendation")
    priority_score: float = Field(50.0, description="Calculated 0-100 deterministic priority ranking score")
    model_confidence: Optional[float] = Field(None, description="Native ML model confidence if provided by model; None for rule-based")
    issue_trend: Optional[str] = Field("NEW", description="NEW | ESCALATING | DE-ESCALATING | STABLE | RECOVERY_PENDING | RECURRENCE")
    escalation_detected: bool = Field(False, description="True if issue escalated in severity since previous check")
    requires_human_confirmation_to_resolve: bool = Field(True, description="Safety rule preventing auto-closure without staff verification")
    historical_occurrence_count: int = Field(1, description="Number of times this issue pattern has been triggered")
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


class OrchestratorAnalysisRequest(BaseModel):
    """
    Flexible request payload accepting either flat HospitalState fields,
    nested hospital_state dictionary, and optional latest pre-computed ML predictions.
    """
    occupancy_percent: Optional[float] = None
    patients_waiting: Optional[float] = None
    available_beds: Optional[float] = None
    arrival_rate: Optional[float] = None
    available_doctors: Optional[float] = None
    available_nurses: Optional[float] = None
    severity_level: Optional[float] = None
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None
    month: Optional[int] = None

    hospital_state: Optional[Dict[str, Any]] = None
    predictions: Optional[Dict[str, Any]] = None


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
