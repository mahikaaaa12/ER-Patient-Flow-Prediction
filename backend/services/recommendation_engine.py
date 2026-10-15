"""
ERFlow Dynamic Operational Recommendation Engine.

Provides an explainable, data-driven recommendation generation pipeline based on
live Emergency Department telemetry and multi-model Machine Learning inference
outputs (LSTM forecast, XGBoost Regressor, XGBoost Classifier, K-Means, DBSCAN).

CLINICAL & ADMINISTRATIVE SAFETY POLICY:
1. Operational decision support only: Recommendations provide department-level
   resource and workflow guidance. They do NOT make autonomous clinical diagnoses,
   prescribe treatments, reassign clinical staff, or override hospital clinical governance.
2. Triage Integrity: Operational recommendations NEVER advise re-classifying clinical
   triage acuity (ESI) solely to improve queue waiting statistics.
3. Mandatory Human Review: Every recommended action requires human verification
   and administrative authorization by charge nurses, bed command, or medical directors.
"""

import math
import logging
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple

from ..schemas.hospital_state import HospitalState
from ..schemas.orchestrator import (
    OperationalIssue,
    RecommendationAction,
    WorkloadFactor,
    ExplanationDetail,
)
from ..schemas.overview import DashboardOverviewResponse

logger = logging.getLogger("erflow.recommendation_engine")


@dataclass
class RecommendationThresholds:
    """
    Configurable operational thresholds for pattern detection.

    NOTE ON THRESHOLD DERIVATION:
    These thresholds represent administrative operational planning benchmarks
    (informed by emergency department throughput guidelines such as ACEP and ENA
    surge frameworks), NOT clinical diagnostic thresholds or validated clinical
    standards. Facilities may calibrate these thresholds to match their specific
    bed complement, historical volume, and staffing matrices.
    """
    occupancy_warning: float = 80.0
    occupancy_critical: float = 90.0
    occupancy_recovery: float = 75.0

    available_beds_warning: float = 5.0
    available_beds_critical: float = 2.0
    available_beds_recovery: float = 7.0

    queue_warning: float = 18.0
    queue_critical: float = 28.0
    queue_recovery: float = 14.0

    wait_time_warning: float = 40.0
    wait_time_critical: float = 60.0
    wait_time_recovery: float = 30.0

    doc_load_warning: float = 4.0
    doc_load_critical: float = 5.5
    doc_load_recovery: float = 3.5

    nurse_load_warning: float = 5.5
    nurse_load_critical: float = 7.5
    nurse_load_recovery: float = 4.5

    target_doc_load: float = 3.5
    target_nurse_load: float = 4.5

    arrival_warning: float = 28.0
    arrival_critical: float = 35.0
    arrival_low_threshold: float = 20.0
    arrival_recovery: float = 22.0

    crowding_score_warning: float = 60.0
    crowding_score_critical: float = 80.0
    crowding_recovery: float = 50.0

    forecast_h3_warning: float = 32.0
    forecast_h3_critical: float = 45.0
    forecast_h3_recovery: float = 25.0
    forecast_peak_rate_warning: float = 30.0
    forecast_peak_rate_recovery: float = 24.0


@dataclass
class PrioritizationWeights:
    """
    Configurable scoring weights for deterministic operational prioritization.
    Scale: 0 - 100 points.
    """
    severity_critical: float = 40.0
    severity_high: float = 28.0
    severity_moderate: float = 16.0
    severity_low: float = 6.0

    urgency_immediate: float = 25.0      # due <= 15 min
    urgency_within_30: float = 18.0     # due <= 30 min
    urgency_within_60: float = 12.0     # due <= 60 min
    urgency_next_shift: float = 4.0     # due > 60 min

    reliability_success: float = 15.0
    reliability_demo: float = 10.0
    reliability_degraded: float = 5.0

    risk_factor_bonus_per_item: float = 2.0  # +2 points per contributing metric beyond 2
    risk_factor_bonus_max: float = 10.0      # Capped at +10 points

    action_feasibility_bonus: float = 5.0

    penalty_acknowledged: float = 10.0
    penalty_monitoring: float = 18.0
    penalty_completed: float = 50.0


SEVERITY_ORDER = {"CRITICAL": 4, "HIGH": 3, "MODERATE": 2, "LOW": 1}


class EDRecommendationEngine:
    """
    Core dynamic recommendation engine synthesizing live operational telemetry
    and ML model outputs into structured, explainable action plans.
    """

    def __init__(
        self,
        thresholds: Optional[RecommendationThresholds] = None,
        prioritization_weights: Optional[PrioritizationWeights] = None,
    ) -> None:
        self.thresholds = thresholds or RecommendationThresholds()
        self.prioritization_weights = prioritization_weights or PrioritizationWeights()
        self._issue_history: Dict[str, Dict[str, Any]] = {}

    def reset_history(self) -> None:
        """Resets active issue history and lifecycle tracking across evaluations."""
        self._issue_history.clear()

    def extract_native_confidence(
        self,
        engine_key: str,
        overview: Optional[DashboardOverviewResponse],
    ) -> Optional[float]:
        """
        Extracts native probabilistic/clustering confidence from model outputs.
        CLINICAL INTEGRITY POLICY:
        Never invent synthetic or random confidence scores for models that do not
        natively output class probabilities or clustering confidence.
        Returns float in [0.0, 1.0] or None.
        """
        if not overview:
            return None

        if engine_key == "crowding_risk":
            crowd = getattr(overview, "crowding_risk", None)
            if crowd and getattr(crowd, "probabilities", None):
                level = getattr(crowd, "crowding_level", "").lower()
                for k, v in crowd.probabilities.items():
                    if k.lower() == level:
                        return round(float(v), 2)
            return None

        elif engine_key in ["flow_pattern", "flow_patterns"]:
            flow = getattr(overview, "flow_pattern", None)
            if flow and getattr(flow, "confidence", None) is not None:
                val = float(flow.confidence)
                if val > 1.0:
                    val = val / 100.0
                return round(val, 2)
            return None

        # Regression (waiting_time), LSTM (forecast), DBSCAN (surge_detection),
        # or pure telemetry rules do NOT output probability distributions
        return None

    def calculate_priority_score(
        self,
        rec: RecommendationAction,
        weights: Optional[PrioritizationWeights] = None,
        action_status: str = "NEW",
        signal_reliability: str = "SUCCESS",
    ) -> float:
        """
        Calculates a deterministic 0 - 100 operational priority score.
        Incorporates severity, urgency window, signal reliability, factor interaction,
        action feasibility, and workflow state penalties.
        """
        w = weights or self.prioritization_weights

        # 1. Base Severity (max 40)
        sev_map = {
            "CRITICAL": w.severity_critical,
            "HIGH": w.severity_high,
            "MODERATE": w.severity_moderate,
            "LOW": w.severity_low,
        }
        score = sev_map.get(rec.severity.upper(), w.severity_low)

        # 2. Urgency Window (max 25)
        if rec.due_in_minutes <= 15:
            score += w.urgency_immediate
        elif rec.due_in_minutes <= 30:
            score += w.urgency_within_30
        elif rec.due_in_minutes <= 60:
            score += w.urgency_within_60
        else:
            score += w.urgency_next_shift

        # 3. Signal Reliability (max 15)
        rel_upper = (signal_reliability or "SUCCESS").upper()
        if "DEMO" in rel_upper:
            score += w.reliability_demo
        elif any(term in rel_upper for term in ["DEGRADED", "LOW", "FAIL"]):
            score += w.reliability_degraded
        else:
            score += w.reliability_success

        # 4. Compounding Risk Factor Interaction Bonus (max 10)
        metrics_count = len(rec.contributing_metrics) if rec.contributing_metrics else 0
        extra_metrics = max(0, metrics_count - 2)
        score += min(w.risk_factor_bonus_max, extra_metrics * w.risk_factor_bonus_per_item)

        # 5. Action Feasibility Bonus (max 5)
        if rec.required_resources and len(rec.required_resources) > 0:
            score += w.action_feasibility_bonus

        # 6. Workflow State Penalty
        status_upper = (action_status or rec.action_status or "NEW").upper()
        if status_upper == "ACKNOWLEDGED":
            score -= w.penalty_acknowledged
        elif status_upper == "MONITORING":
            score -= w.penalty_monitoring
        elif status_upper == "COMPLETED":
            score -= w.penalty_completed

        return round(max(0.0, min(100.0, score)), 1)

    def merge_recommendations(
        self,
        raw_recs: List[RecommendationAction],
    ) -> List[RecommendationAction]:
        """
        Merges overlapping recommendations concerning the same operational problem.
        Preserves distinct recommended actions, combines contributing metrics,
        and retains the highest severity and most urgent timeframe.
        """
        if not raw_recs:
            return []

        grouped: Dict[str, List[RecommendationAction]] = {}
        for r in raw_recs:
            grouped.setdefault(r.id, []).append(r)

        merged: List[RecommendationAction] = []
        for rec_id, group in grouped.items():
            if len(group) == 1:
                merged.append(group[0])
                continue

            # Sort group by severity descending, due time ascending
            group.sort(
                key=lambda x: (-SEVERITY_ORDER.get(x.severity, 1), x.due_in_minutes)
            )
            primary = group[0]

            # Combine distinct recommended actions preserving order
            seen_actions = set()
            merged_actions = []
            for g in group:
                for act in g.recommended_actions:
                    if act and act not in seen_actions:
                        seen_actions.add(act)
                        merged_actions.append(act)
            if not merged_actions:
                merged_actions = [primary.recommended_action]

            # Combine contributing metrics
            merged_metrics = {}
            for g in group:
                if g.contributing_metrics:
                    merged_metrics.update(g.contributing_metrics)

            # Combine contributing models
            seen_models = set()
            merged_models = []
            for g in group:
                for m in g.contributing_models:
                    if m not in seen_models:
                        seen_models.add(m)
                        merged_models.append(m)

            # Combine contributing fields
            seen_fields = set()
            merged_fields = []
            for g in group:
                for fld in g.contributing_fields:
                    if fld not in seen_fields:
                        seen_fields.add(fld)
                        merged_fields.append(fld)

            # Combine contributing factors (unique by name, highest score)
            factor_map = {}
            for g in group:
                for fct in g.contributing_factors:
                    if fct.name not in factor_map or fct.contribution_score > factor_map[fct.name].contribution_score:
                        factor_map[fct.name] = fct
            merged_factors = list(factor_map.values())

            # Combine required resources and approvals
            seen_res = set()
            merged_res = []
            for g in group:
                for res in g.required_resources:
                    if res not in seen_res:
                        seen_res.add(res)
                        merged_res.append(res)

            seen_appr = set()
            merged_appr = []
            for g in group:
                for app in g.required_approvals:
                    if app not in seen_appr:
                        seen_appr.add(app)
                        merged_appr.append(app)

            # Preserve native model confidence if any candidate in group has it
            native_conf = next(
                (g.model_confidence for g in group if g.model_confidence is not None),
                None
            )

            merged_rec = RecommendationAction(
                id=primary.id,
                category=primary.category,
                priority=primary.priority,
                severity=primary.severity,
                title=primary.title,
                description=primary.description,
                recommended_action=merged_actions[0],
                recommended_actions=merged_actions,
                contributing_metrics=merged_metrics,
                contributing_models=merged_models,
                contributing_fields=merged_fields,
                source_prediction=primary.source_prediction,
                urgency=primary.urgency,
                due_in_minutes=min(g.due_in_minutes for g in group),
                contributing_factors=merged_factors,
                reason=primary.reason,
                rule_id=primary.rule_id,
                rule_explanation=" ; ".join(dict.fromkeys(g.rule_explanation for g in group if g.rule_explanation)),
                forecast_horizon=primary.forecast_horizon,
                required_resources=merged_res,
                required_approvals=merged_appr,
                action_status=primary.action_status,
                confidence=primary.confidence,
                explanation_detail=primary.explanation_detail,
                requires_human_review=any(g.requires_human_review for g in group),
                priority_score=0.0,
                model_confidence=native_conf,
                issue_trend=primary.issue_trend,
                escalation_detected=any(g.escalation_detected for g in group),
                requires_human_confirmation_to_resolve=any(g.requires_human_confirmation_to_resolve for g in group),
                historical_occurrence_count=max(g.historical_occurrence_count for g in group),
            )
            merged.append(merged_rec)

        return merged

    def merge_issues(
        self,
        raw_issues: List[OperationalIssue],
    ) -> List[OperationalIssue]:
        """
        Merges duplicate or related issues targeting the same domain problem.
        """
        if not raw_issues:
            return []

        def canonical_id(iid: str) -> str:
            if iid in ["iss-bed-deficit", "iss-bed-capacity"]:
                return "iss-bed-capacity"
            return iid

        grouped: Dict[str, List[OperationalIssue]] = {}
        for iss in raw_issues:
            cid = canonical_id(iss.id)
            grouped.setdefault(cid, []).append(iss)

        merged: List[OperationalIssue] = []
        for cid, group in grouped.items():
            if len(group) == 1:
                item = group[0]
                if item.id != cid:
                    item = OperationalIssue(
                        id=cid,
                        category=item.category,
                        severity=item.severity,
                        title=item.title,
                        description=item.description,
                        affected_metrics=item.affected_metrics,
                    )
                merged.append(item)
                continue

            group.sort(key=lambda x: -SEVERITY_ORDER.get(x.severity, 1))
            primary = group[0]

            seen_metrics = set()
            merged_metrics = []
            for g in group:
                for m in g.affected_metrics:
                    if m not in seen_metrics:
                        seen_metrics.add(m)
                        merged_metrics.append(m)

            merged.append(
                OperationalIssue(
                    id=cid,
                    category=primary.category,
                    severity=primary.severity,
                    title=primary.title,
                    description=" | ".join(dict.fromkeys(g.description for g in group if g.description)),
                    affected_metrics=merged_metrics,
                )
            )

        return merged

    def format_shap_factors(
        self,
        shap_list: List[Dict[str, Any]],
        default_factors: List[WorkloadFactor]
    ) -> List[WorkloadFactor]:
        """Formats TreeSHAP attribution dicts into standardized WorkloadFactor objects."""
        if not shap_list:
            return default_factors
        formatted = []
        for f in shap_list[:4]:
            feat_name = f.get("feature", "Telemetry Feature")
            imp = float(f.get("importance", 0.25)) * 100.0
            dir_str = f.get("direction", "increases")
            impact = "increases_pressure" if dir_str == "increases" else "decreases_pressure"
            formatted.append(
                WorkloadFactor(
                    name=feat_name,
                    impact=impact,
                    contribution_score=round(imp, 1),
                    detail=f"{feat_name} feature attribution indicates it {dir_str} model risk (+{imp:.1f}% relative weight)",
                )
            )
        return formatted if formatted else default_factors

    def evaluate_rules(
        self,
        state: HospitalState,
        overview: Optional[DashboardOverviewResponse] = None,
        engine_status: Optional[Dict[str, str]] = None,
        degraded_mode: bool = False,
        thresholds: Optional[RecommendationThresholds] = None,
        prioritization_weights: Optional[PrioritizationWeights] = None,
        action_statuses: Optional[Dict[str, str]] = None,
    ) -> Tuple[List[OperationalIssue], List[RecommendationAction]]:
        """
        Evaluates configurable rules across current ER telemetry and available ML predictions.

        Requirements:
        1. Consume actual structured outputs of each available engine. Never substitute fake predictions.
        2. Handle individual model failures independently without crashing.
        3. Clearly distinguish unavailable/failed models from valid ones; never treat missing as zero.
        4. Allow recommendations to depend on multiple model outputs when available.
        5. Record which models and fields contributed to each recommendation.

        Returns:
            Tuple of (prioritized_issues, recommended_actions).
        """
        th = thresholds or self.thresholds
        eng_status = engine_status or (overview.engine_status if overview and overview.engine_status else {})

        def get_confidence(engine_key: str) -> str:
            st = eng_status.get(engine_key, "success")
            if st == "success":
                return "HIGH"
            elif st == "demo":
                return "MEDIUM"
            return "LOW (DEGRADED)"

        # 1. Extract telemetry inputs safely
        occ = float(getattr(state, "occupancy_percent", 78.0) or 0.0)
        waiting = float(getattr(state, "patients_waiting", 24.0) or 0.0)
        beds = float(getattr(state, "available_beds", 8.0) or 0.0)
        arr_rate = float(getattr(state, "arrival_rate", 28.0) or 0.0)
        acuity = float(getattr(state, "severity_level", 3.0) or 3.0)
        docs = max(1.0, float(getattr(state, "available_doctors", 5.0) or 1.0))
        nurses = max(1.0, float(getattr(state, "available_nurses", 9.0) or 1.0))

        # 2. Safely inspect validity of each ML engine independently
        # NEVER treat missing predictions as zero. NEVER substitute fake outputs.
        is_fc_valid = (
            eng_status.get("forecast") in ["success", "demo"]
            and getattr(overview, "forecast", None) is not None
            and getattr(getattr(overview, "forecast", None), "error", None) is None
        )
        forecast_obj = getattr(overview, "forecast", None) if is_fc_valid else None
        h3_arrivals = (
            float(forecast_obj.horizons.get("3h"))
            if forecast_obj and forecast_obj.horizons and "3h" in forecast_obj.horizons
            else None
        )
        peak_rate = (
            float(forecast_obj.predicted_peak_rate)
            if forecast_obj and getattr(forecast_obj, "predicted_peak_rate", None) is not None
            else None
        )
        peak_time = forecast_obj.predicted_peak_time if forecast_obj and getattr(forecast_obj, "predicted_peak_time", None) else None
        forecast_trend = forecast_obj.trend if forecast_obj and getattr(forecast_obj, "trend", None) else None

        is_wt_valid = (
            eng_status.get("waiting_time") in ["success", "demo"]
            and getattr(overview, "waiting_time", None) is not None
            and getattr(getattr(overview, "waiting_time", None), "error", None) is None
        )
        wt_obj = getattr(overview, "waiting_time", None) if is_wt_valid else None
        wait_min = (
            float(wt_obj.waiting_time_minutes)
            if wt_obj and getattr(wt_obj, "waiting_time_minutes", None) is not None
            else None
        )
        wait_trend = wt_obj.trend if wt_obj and getattr(wt_obj, "trend", None) else None
        wt_shap_factors = wt_obj.explanation.get("top_factors", []) if wt_obj and wt_obj.explanation else []

        is_crowd_valid = (
            eng_status.get("crowding_risk") in ["success", "demo"]
            and getattr(overview, "crowding_risk", None) is not None
            and getattr(getattr(overview, "crowding_risk", None), "error", None) is None
        )
        crowd_obj = getattr(overview, "crowding_risk", None) if is_crowd_valid else None
        crowding_score = (
            float(crowd_obj.crowding_score)
            if crowd_obj and getattr(crowd_obj, "crowding_score", None) is not None
            else None
        )
        crowding_level = (
            crowd_obj.crowding_level.upper()
            if crowd_obj and getattr(crowd_obj, "crowding_level", None)
            else None
        )
        crowd_shap_factors = crowd_obj.explanation.get("top_factors", []) if crowd_obj and crowd_obj.explanation else []

        is_flow_valid = (
            (eng_status.get("flow_pattern") in ["success", "demo"] or eng_status.get("flow_patterns") in ["success", "demo"])
            and getattr(overview, "flow_pattern", None) is not None
            and getattr(getattr(overview, "flow_pattern", None), "error", None) is None
        )
        flow_obj = getattr(overview, "flow_pattern", None) if is_flow_valid else None
        pattern_name = flow_obj.pattern_name if flow_obj and getattr(flow_obj, "pattern_name", None) else None

        is_surge_valid = (
            eng_status.get("surge_detection") in ["success", "demo"]
            and getattr(overview, "surge_detection", None) is not None
            and getattr(getattr(overview, "surge_detection", None), "error", None) is None
        )
        surge_obj = getattr(overview, "surge_detection", None) if is_surge_valid else None
        is_surge = bool(surge_obj.is_surge) if surge_obj and getattr(surge_obj, "is_surge", None) is not None else None
        surge_status = surge_obj.status if surge_obj and getattr(surge_obj, "status", None) else None
        surge_dev = surge_obj.deviation_percent if surge_obj and getattr(surge_obj, "deviation_percent", None) else None

        # Ratios
        doc_load_ratio = round(waiting / docs, 1)
        occupied_beds_est = max(0.0, (occ / 100.0) * 35.0)
        nurse_load_ratio = round((waiting + occupied_beds_est) / nurses, 1)

        prioritized_issues: List[OperationalIssue] = []
        recommended_actions: List[RecommendationAction] = []

        # ==============================================================================
        # PATTERN 1: High Occupancy Combined with Increasing Arrivals / Inflow
        # Multi-model synthesis: Combines Bed Occupancy + (LSTM Forecast OR Arrival Velocity) + (Crowding Classifier if valid)
        # ==============================================================================
        is_occ_high = occ >= th.occupancy_warning or beds <= th.available_beds_warning
        fc_inflow_rising = is_fc_valid and (
            forecast_trend == "Increasing"
            or (h3_arrivals is not None and h3_arrivals >= th.forecast_h3_warning)
        )
        telem_inflow_rising = arr_rate >= th.arrival_warning
        is_inflow_rising = fc_inflow_rising or telem_inflow_rising

        if is_occ_high and is_inflow_rising:
            issue_sev = "CRITICAL" if (occ >= th.occupancy_critical or beds <= th.available_beds_critical) else "HIGH"
            rule_id = "RULE_OCC_HIGH_ARRIVAL_RISING"

            # Track contributing models and fields
            contributing_models: List[str] = []
            contributing_fields: List[str] = ["occupancy_percent", "available_beds"]

            inflow_desc = []
            if fc_inflow_rising and h3_arrivals is not None:
                contributing_models.append("2-Layer Keras LSTM Neural Network (Arrival Forecast)")
                contributing_fields.extend(["predicted_3h_arrivals", "forecast_trend"])
                inflow_desc.append(f"Inflow projections indicate {round(h3_arrivals)} arrivals over next 3 hours (trend: {forecast_trend})")
            if telem_inflow_rising:
                contributing_fields.append("arrival_rate")
                inflow_desc.append(f"Arrival velocity is {arr_rate:.0f} pts/hr")
            if is_crowd_valid and crowding_score is not None:
                contributing_models.append("Supervised XGBoost Classifier (Crowding Risk)")
                contributing_fields.append("crowding_score")

            rule_exp = (
                f"Triggered by bed occupancy at {occ:.0f}% (threshold: >={th.occupancy_warning:.0f}%) "
                f"or staffed beds at {beds:.0f} (threshold: <={th.available_beds_warning:.0f}), "
                f"combined with incoming arrival velocity ({arr_rate:.0f} pts/hr) "
                f"{f'and 3-hour forecast ({round(h3_arrivals)} pts)' if h3_arrivals is not None else '(forecast unavailable)'}."
            )

            desc = f"Bed occupancy telemetry stands at {occ:.0f}% capacity with {beds:.0f} available beds. {'; '.join(inflow_desc)}."

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-bed-capacity",
                    category="BED CAPACITY",
                    severity=issue_sev,
                    title="Elevated Bed Occupancy & Increasing Inflow",
                    description=desc,
                    affected_metrics=contributing_fields,
                )
            )

            default_bed_factors = [
                WorkloadFactor(name="Occupancy Percent", impact="increases_pressure", contribution_score=occ, detail=f"Bed occupancy telemetry stands at {occ:.0f}% capacity"),
                WorkloadFactor(name="Available Beds", impact="increases_pressure", contribution_score=beds, detail=f"Only {beds:.0f} staffed beds currently unassigned"),
            ]
            if h3_arrivals is not None:
                default_bed_factors.append(
                    WorkloadFactor(name="Predicted 3h Inflow", impact="increases_pressure", contribution_score=h3_arrivals, detail=f"LSTM projects {round(h3_arrivals)} arrivals")
                )
            else:
                default_bed_factors.append(
                    WorkloadFactor(name="Arrival Velocity", impact="increases_pressure", contribution_score=arr_rate, detail=f"{arr_rate:.0f} arrivals/hr")
                )

            bed_factors = self.format_shap_factors(crowd_shap_factors if is_crowd_valid else [], default_bed_factors)
            strongest_bed_factor = bed_factors[0].name if bed_factors else "Occupancy Percent"

            action_items = [
                "Coordinate with hospital bed command to expedite pending inpatient transfers and clear emergency department boarding bays.",
                "Activate the hospital discharge lounge for stable admitted patients awaiting transportation or home medications.",
                "Alert environmental services (EVS) to prioritize rapid sanitization turnover for vacant inpatient beds.",
                "Convene multidisciplinary bed management huddle with floor charge nurses to identify anticipated same-day discharges.",
            ]

            metrics_record: Dict[str, Any] = {
                "occupancy_percent": occ,
                "available_beds": beds,
                "arrival_rate": arr_rate,
            }
            if h3_arrivals is not None:
                metrics_record["predicted_3h_arrivals"] = round(h3_arrivals)
                metrics_record["forecast_trend"] = forecast_trend
            else:
                metrics_record["forecast_status"] = "UNAVAILABLE"

            if crowding_score is not None:
                metrics_record["crowding_score"] = crowding_score
            else:
                metrics_record["crowding_status"] = "UNAVAILABLE"

            source_pred = (
                "Supervised XGBoost Classifier & LSTM Forecast"
                if (is_crowd_valid and is_fc_valid)
                else ("2-Layer LSTM Neural Network" if is_fc_valid else "Department Bed Telemetry")
            )

            recommended_actions.append(
                RecommendationAction(
                    id="rec-bed-capacity",
                    category="BED CAPACITY",
                    priority=issue_sev,
                    severity=issue_sev,
                    title="Accelerate Inpatient Transfers & Activate Discharge Lounge",
                    description=f"High bed occupancy ({occ:.0f}%) is associated with prolonged treatment bay turnover for incoming arrivals ({arr_rate:.0f} pts/hr).",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics=metrics_record,
                    contributing_models=contributing_models,
                    contributing_fields=contributing_fields,
                    source_prediction=source_pred,
                    urgency="IMMEDIATE" if issue_sev == "CRITICAL" else "WITHIN 30 MIN",
                    due_in_minutes=15 if issue_sev == "CRITICAL" else 30,
                    contributing_factors=bed_factors,
                    reason=f"Current occupancy ({occ:.0f}%) exceeds standard operational safety thresholds ({th.occupancy_warning:.0f}%) while demand is rising.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon="3h" if is_fc_valid else None,
                    required_resources=["Hospital Bed Command Coordinator", "Discharge Lounge Capacity", "Environmental Services Fast-Turn Team"],
                    required_approvals=["Attending Physician Order Review", "Hospital Bed Placement Authority"],
                    action_status="NEW",
                    confidence=get_confidence("crowding_risk") if is_crowd_valid else "HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Bed capacity strain was flagged because telemetry indicates occupancy at {occ:.0f}% capacity with {beds:.0f} available beds, correlated with rising arrivals.",
                        contributing_factors=bed_factors,
                        strongest_influencer=f"Feature attribution indicates '{strongest_bed_factor}' has the strongest mathematical influence on this capacity alert.",
                        triggering_prediction=(
                            f"XGBoost Crowding Classifier score {crowding_score}/100 and LSTM 3h forecast of {round(h3_arrivals)} patients."
                            if (crowding_score is not None and h3_arrivals is not None)
                            else f"Live telemetry occupancy at {occ:.0f}% and arrival rate of {arr_rate:.0f} pts/hr."
                        ),
                        expected_operational_condition="Treatment bay turnover is projected to stall as incoming arrivals enter the department.",
                        staff_review_guidance="Command staff should review inpatient transfer holding times, bed cleaning turnover velocity, and discharge lounge availability.",
                    ),
                    requires_human_review=True,
                    model_confidence=self.extract_native_confidence("crowding_risk", overview) if is_crowd_valid else None,
                )
            )

        # ==============================================================================
        # PATTERN 2: Large Waiting Queue Combined with Elevated Predicted Waiting Time
        # Multi-model synthesis: Combines Queue Telemetry + XGBoost Regressor wait prediction
        # ==============================================================================
        queue_elevated = waiting >= th.queue_warning
        wait_predicted_elevated = is_wt_valid and (wait_min is not None and wait_min >= th.wait_time_warning)

        if queue_elevated or wait_predicted_elevated:
            queue_sev = "CRITICAL" if (waiting >= th.queue_critical or (wait_min is not None and wait_min >= th.wait_time_critical)) else "HIGH"
            rule_id = "RULE_QUEUE_ELEVATED_WAIT"

            contributing_models = []
            contributing_fields = ["patients_waiting"]
            if is_wt_valid and wait_min is not None:
                contributing_models.append("Supervised XGBoost Regressor (Waiting Time)")
                contributing_fields.extend(["waiting_time_minutes", "wait_trend"])

            rule_exp = (
                f"Triggered by triage queue length of {waiting:.0f} patients (threshold: >={th.queue_warning:.0f}) "
                f"{f'and predicted wait time of {wait_min:.0f} min (threshold: >={th.wait_time_warning:.0f} min, trend: {wait_trend})' if wait_min is not None else '(wait time model unavailable)'}."
            )

            desc = (
                f"Telemetry indicates {waiting:.0f} patients waiting in triage. XGBoost Regressor projects an average wait time of {wait_min:.0f} minutes (trend: {wait_trend})."
                if wait_min is not None
                else f"Telemetry indicates {waiting:.0f} patients waiting in triage (waiting-time prediction model currently unavailable)."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-waiting-queue",
                    category="WAITING QUEUE",
                    severity=queue_sev,
                    title="Triage Queue Stagnation & Long Wait Times",
                    description=desc,
                    affected_metrics=contributing_fields,
                )
            )

            default_queue_factors = [
                WorkloadFactor(name="Patients Waiting", impact="increases_pressure", contribution_score=waiting, detail=f"{waiting:.0f} patients currently in triage queue"),
                WorkloadFactor(name="Arrival Velocity", impact="increases_pressure", contribution_score=arr_rate, detail=f"{arr_rate:.0f} arrivals per hour"),
            ]
            if wait_min is not None:
                default_queue_factors.insert(
                    1,
                    WorkloadFactor(name="XGBoost Wait Time Regressor", impact="increases_pressure", contribution_score=wait_min, detail=f"Predicted wait time of {wait_min:.0f} min")
                )

            queue_factors = self.format_shap_factors(wt_shap_factors if is_wt_valid else [], default_queue_factors)
            strongest_queue_factor = queue_factors[0].name if queue_factors else "Patients Waiting"

            action_items = [
                "Deploy auxiliary triage intake nurse to conduct secondary screening and rapid vital sign re-checks.",
                "Open and staff the dedicated fast-track intake area for lower-acuity ESI 4-5 patients to decongest the main waiting area.",
                "Initiate physician-at-triage (PAT) rapid medical screening for early diagnostic order placement where provider staffing permits.",
                "Reassess waiting room patients at regular 30-minute intervals for clinical acuity changes per departmental policy.",
            ]

            wt_metrics: Dict[str, Any] = {
                "patients_waiting": waiting,
                "arrival_rate": arr_rate,
            }
            if wait_min is not None:
                wt_metrics["waiting_time_minutes"] = round(wait_min, 1)
                wt_metrics["wait_trend"] = wait_trend
            else:
                wt_metrics["waiting_time_status"] = "UNAVAILABLE"

            recommended_actions.append(
                RecommendationAction(
                    id="rec-triage-capacity",
                    category="TRIAGE CAPACITY",
                    priority=queue_sev,
                    severity=queue_sev,
                    title="Deploy Auxiliary Triage Screening & Open Fast-Track Bay",
                    description=f"Queue length ({waiting:.0f} patients) is associated with triage intake bottlenecks.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics=wt_metrics,
                    contributing_models=contributing_models,
                    contributing_fields=contributing_fields,
                    source_prediction="Supervised XGBoost Regressor (Waiting Time)" if is_wt_valid else "Triage Telemetry Queue",
                    urgency="IMMEDIATE" if queue_sev == "CRITICAL" else "WITHIN 30 MIN",
                    due_in_minutes=15 if queue_sev == "CRITICAL" else 30,
                    contributing_factors=queue_factors,
                    reason=f"Queue volume ({waiting:.0f} pts) requires intake expansion to prevent clinical deterioration.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon="1h",
                    required_resources=["Auxiliary Triage Intake Station", "Fast-Track Treatment Bay", "Point-of-Care Diagnostic Testing Kits"],
                    required_approvals=["Triage Charge Nurse", "Emergency Department Medical Director"],
                    action_status="NEW",
                    confidence=get_confidence("waiting_time") if is_wt_valid else "HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Triage queue strain was detected because telemetry indicates {waiting:.0f} patients waiting.",
                        contributing_factors=queue_factors,
                        strongest_influencer=f"TreeSHAP feature attributions show '{strongest_queue_factor}' exerts the highest quantitative weight.",
                        triggering_prediction=(
                            f"Supervised XGBoost Regressor output of {wait_min:.0f} minutes (trend: {wait_trend})."
                            if wait_min is not None
                            else f"Active telemetry triage queue count of {waiting:.0f} patients."
                        ),
                        expected_operational_condition=f"Triage processing delays are expected to increase if arrival velocity ({arr_rate:.0f} pts/hr) continues to exceed intake rate.",
                        staff_review_guidance="Staff should review triage screening nurse availability, ESI classification speed, and fast-track bay staffing. CLINICAL SAFETY POLICY: Do NOT adjust patient triage priority solely to alter queue statistics.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # PATTERN 3: High Patient-to-Staff Ratios (Physician & Nursing Saturation)
        # ==============================================================================
        if doc_load_ratio >= th.doc_load_warning or nurse_load_ratio >= th.nurse_load_warning:
            staff_sev = "CRITICAL" if (doc_load_ratio >= th.doc_load_critical or nurse_load_ratio >= th.nurse_load_critical) else "HIGH"
            rule_id = "RULE_STAFFING_RATIO_SATURATION"

            needed_docs = max(0, math.ceil(waiting / th.target_doc_load) - int(docs))
            needed_nurses = max(0, math.ceil((waiting + occupied_beds_est) / th.target_nurse_load) - int(nurses))

            contributing_models = []
            contributing_fields = ["available_doctors", "available_nurses", "doctor_load_ratio", "nurse_load_ratio", "patients_waiting"]
            if is_wt_valid and wait_min is not None:
                contributing_models.append("Supervised XGBoost Regressor (Waiting Time)")
                contributing_fields.append("waiting_time_minutes")

            rule_exp = (
                f"Triggered by doctor load ratio of {doc_load_ratio} pts/MD (threshold: >={th.doc_load_warning}) "
                f"or nurse load ratio of {nurse_load_ratio} active pts/RN (threshold: >={th.nurse_load_warning}). "
                f"Recommended target ratios: {th.target_doc_load} pts/MD and {th.target_nurse_load} pts/RN."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-staffing-strain",
                    category="STAFFING",
                    severity=staff_sev,
                    title="Physician & Nursing Workload Saturation",
                    description=f"Staff workload ratios indicate heavy strain: {doc_load_ratio} waiting pts/MD (target: {th.target_doc_load}) and {nurse_load_ratio} active pts/RN (target: {th.target_nurse_load}).",
                    affected_metrics=contributing_fields,
                )
            )

            staff_factors = [
                WorkloadFactor(name="Doctor Load Ratio", impact="increases_pressure", contribution_score=doc_load_ratio, detail=f"{doc_load_ratio} waiting patients per active physician"),
                WorkloadFactor(name="Nurse Load Ratio", impact="increases_pressure", contribution_score=nurse_load_ratio, detail=f"{nurse_load_ratio} active patients per active nurse"),
                WorkloadFactor(name="Active Staff Count", impact="decreases_pressure", contribution_score=docs + nurses, detail=f"{docs:.0f} MDs and {nurses:.0f} RNs on active shift"),
            ]

            action_items = [
                f"Request float pool nursing assistance (+{max(1, needed_nurses)} RNs recommended to reach target ratio of {th.target_nurse_load} active pts/RN).",
                f"Adjust provider shift assignments or call in on-call mid-level provider (+{max(1, needed_docs)} MD/DO recommended to reach target of {th.target_doc_load} pts/MD).",
                "Assign clinical support technicians to relieve nurses of non-clinical administrative and transport duties.",
                "Review pending provider sign-offs and patient disposition orders to accelerate discharge workflows.",
            ]

            staff_metrics = {
                "doctor_load_ratio": doc_load_ratio,
                "nurse_load_ratio": nurse_load_ratio,
                "available_doctors": docs,
                "available_nurses": nurses,
                "patients_waiting": waiting,
                "deficit_nurses": needed_nurses,
                "deficit_doctors": needed_docs,
            }
            if wait_min is not None:
                staff_metrics["waiting_time_minutes"] = round(wait_min, 1)

            recommended_actions.append(
                RecommendationAction(
                    id="rec-staffing-allocation",
                    category="STAFFING",
                    priority=staff_sev,
                    severity=staff_sev,
                    title="Request Float Pool Coverage & Adjust Provider Shift Assignment",
                    description=f"Physicians are handling {doc_load_ratio} waiting patients each, while nurses care for an average of {nurse_load_ratio} active patients.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics=staff_metrics,
                    contributing_models=contributing_models,
                    contributing_fields=contributing_fields,
                    source_prediction="Department Workload Ratio Analysis",
                    urgency="WITHIN 30 MIN",
                    due_in_minutes=30,
                    contributing_factors=staff_factors,
                    reason=f"Workload ratios exceed recommended clinical throughput baselines ({th.target_doc_load} pts/MD, {th.target_nurse_load} pts/RN) in active shift telemetry.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon=None,
                    required_resources=[f"Float Pool Nursing (+{max(1, needed_nurses)} RNs)", f"On-Call Clinical Provider (+{max(1, needed_docs)} MD/DO)"],
                    required_approvals=["Nursing Supervisor", "Chief of Emergency Medicine"],
                    action_status="NEW",
                    confidence="HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Staffing workload saturation was flagged because physician load ({doc_load_ratio} pts/MD) and nurse load ({nurse_load_ratio} pts/RN) exceed recommended operational baselines.",
                        contributing_factors=staff_factors,
                        strongest_influencer=f"Staff workload ratio calculations indicate 'Doctor Load Ratio' ({doc_load_ratio} pts/MD) is the primary driver of provider strain.",
                        triggering_prediction=f"Derived ratio analysis combined with active shift telemetry ({docs:.0f} MDs, {nurses:.0f} RNs).",
                        expected_operational_condition="Staff fatigue and delayed order execution may occur if provider-to-patient ratios remain elevated.",
                        staff_review_guidance="Review float pool nurse availability, attending physician shift overlaps, and mid-level provider coverage.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # PATTERN 4: Limited Available Beds with High Intake Demand
        # ==============================================================================
        if beds <= th.available_beds_warning and (occ >= 75.0 or waiting >= 15.0):
            bed_sev = "CRITICAL" if beds <= th.available_beds_critical else "HIGH"
            rule_id = "RULE_BED_CAPACITY_BOTTLENECK"
            rule_exp = (
                f"Triggered by unassigned staffed beds at {beds:.0f} (threshold: <={th.available_beds_warning:.0f}) "
                f"with elevated occupancy ({occ:.0f}%) or waiting queue ({waiting:.0f} pts)."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-bed-deficit",
                    category="BED CAPACITY",
                    severity=bed_sev,
                    title="Critical Bed Inventory Depletion",
                    description=f"Department bed inventory has dropped to {beds:.0f} available beds with {waiting:.0f} patients in triage queue and {occ:.0f}% occupancy.",
                    affected_metrics=["available_beds", "occupancy_percent", "patients_waiting"],
                )
            )

            bed_res = [
                WorkloadFactor(name="Available Beds", impact="increases_pressure", contribution_score=beds, detail=f"Only {beds:.0f} staffed beds unassigned"),
                WorkloadFactor(name="Occupancy Percent", impact="increases_pressure", contribution_score=occ, detail=f"Bed occupancy telemetry at {occ:.0f}%"),
            ]

            action_items = [
                "Conduct department-wide bed utilization audit to identify patients meeting observation discharge criteria.",
                "Prepare temporary flex/hallway bays strictly for stabilized patients per hospital surge plan.",
                "Coordinate with hospital transport services to prioritize patient moves from ER bays to inpatient units.",
            ]

            recommended_actions.append(
                RecommendationAction(
                    id="rec-bed-capacity",
                    category="BED CAPACITY",
                    priority=bed_sev,
                    severity=bed_sev,
                    title="Mobilize Bed Turnover Team & Inpatient Placement",
                    description=f"Staffed bed availability ({beds:.0f} beds) is insufficient to support ongoing triage queue demand ({waiting:.0f} pts).",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics={
                        "available_beds": beds,
                        "occupancy_percent": occ,
                        "patients_waiting": waiting,
                    },
                    contributing_models=[],
                    contributing_fields=["available_beds", "occupancy_percent", "patients_waiting"],
                    source_prediction="Hospital Bed Telemetry Inventory",
                    urgency="IMMEDIATE" if bed_sev == "CRITICAL" else "WITHIN 30 MIN",
                    due_in_minutes=15 if bed_sev == "CRITICAL" else 30,
                    contributing_factors=bed_res,
                    reason=f"Available staffed bed count ({beds:.0f}) is below operational buffer threshold ({th.available_beds_warning:.0f}).",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon=None,
                    required_resources=["Hospital Bed Placement Coordinator", "Observation Unit Beds", "Bed Cleaning Crew"],
                    required_approvals=["Bed Placement Coordinator", "Hospital Operations Administrator"],
                    action_status="NEW",
                    confidence="HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Bed deficit alert triggered because available bed inventory ({beds:.0f}) has depleted while {waiting:.0f} patients wait in queue.",
                        contributing_factors=bed_res,
                        strongest_influencer="Available Beds inventory is at critical operational minimum.",
                        triggering_prediction="Current bed availability telemetry.",
                        expected_operational_condition="Arrivals requiring bed placement will experience extended hallway holds.",
                        staff_review_guidance="Review pending inpatient discharge orders and expedite room turnover.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # PATTERN 5: Sudden Influx Surge / Anomalous Arrival Spikes
        # Consumes Unsupervised DBSCAN Surge Output
        # ==============================================================================
        model_surge = is_surge_valid and bool(is_surge)
        telem_surge = arr_rate >= th.arrival_critical

        if model_surge or telem_surge:
            surge_sev = "CRITICAL"
            rule_id = "RULE_SURGE_ANOMALOUS_INFLUX"

            contributing_models = []
            contributing_fields = ["arrival_rate"]
            if model_surge:
                contributing_models.append("Unsupervised DBSCAN Anomaly Engine (Surge Detection)")
                contributing_fields.extend(["is_surge", "surge_status", "deviation_percent"])

            rule_exp = (
                f"Triggered by DBSCAN anomaly detection status '{surge_status}' "
                f"or arrival velocity at {arr_rate:.0f} pts/hr (threshold: >={th.arrival_critical:.0f} pts/hr, deviation: {surge_dev})."
                if model_surge
                else f"Triggered by arrival velocity at {arr_rate:.0f} pts/hr (threshold: >={th.arrival_critical:.0f} pts/hr; DBSCAN model unavailable)."
            )

            desc = (
                f"Current arrival rate of {arr_rate:.0f} pts/hr deviates by {surge_dev} from expected hourly baseline."
                if surge_dev is not None
                else f"Current arrival rate of {arr_rate:.0f} pts/hr exceeds department critical threshold."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-arrival-surge",
                    category="SURGE",
                    severity=surge_sev,
                    title="Anomalous Patient Arrival Velocity Surge",
                    description=desc,
                    affected_metrics=contributing_fields,
                )
            )

            surge_factors = [
                WorkloadFactor(name="Arrival Rate Velocity", impact="increases_pressure", contribution_score=arr_rate, detail=f"{arr_rate:.0f} arrivals per hour"),
            ]
            if model_surge:
                surge_factors.append(
                    WorkloadFactor(name="DBSCAN Anomaly Detector", impact="increases_pressure", contribution_score=100.0, detail=surge_status or "Surge Anomaly")
                )

            action_items = [
                "Activate Emergency Department Internal Surge Plan (Level 1) and notify the administrative nursing supervisor.",
                "Contact regional EMS coordinator to report high department pressure and evaluate regional ambulance routing status.",
                "Establish auxiliary registration checkpoint to prevent intake bottleneck for incoming walk-in arrivals.",
                "Pre-alert trauma and critical care resuscitation teams for potential acute volume escalation.",
            ]

            surge_metrics: Dict[str, Any] = {"arrival_rate": arr_rate}
            if model_surge:
                surge_metrics.update({
                    "is_surge": is_surge,
                    "surge_status": surge_status,
                    "deviation_percent": surge_dev,
                })
            else:
                surge_metrics["surge_model_status"] = "UNAVAILABLE"

            recommended_actions.append(
                RecommendationAction(
                    id="rec-surge-mitigation",
                    category="ARRIVAL PRESSURE",
                    priority=surge_sev,
                    severity=surge_sev,
                    title="Activate Emergency Arrival Surge Protocol & Notify EMS",
                    description=f"Arrival velocity ({arr_rate:.0f} pts/hr) is associated with an unpredicted arrival influx.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics=surge_metrics,
                    contributing_models=contributing_models,
                    contributing_fields=contributing_fields,
                    source_prediction="Unsupervised DBSCAN Anomaly Engine" if model_surge else "Telemetry Arrival Rate Spike",
                    urgency="IMMEDIATE",
                    due_in_minutes=10,
                    contributing_factors=surge_factors,
                    reason=f"Arrival rate spike ({arr_rate:.0f} pts/hr) deviating from statistical baseline.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon="1h",
                    required_resources=["EMS Communication Link", "Auxiliary Registration Checkpoint", "Rapid Triage Staffing"],
                    required_approvals=["Emergency Department Medical Director", "Regional EMS Dispatch Liaison"],
                    action_status="NEW",
                    confidence=get_confidence("surge_detection") if is_surge_valid else "HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Arrival surge was detected because arrival velocity ({arr_rate:.0f} pts/hr) indicates an acute volume influx.",
                        contributing_factors=surge_factors,
                        strongest_influencer="Statistical evaluation of arrival rate velocity over rolling shift baseline.",
                        triggering_prediction=(
                            f"DBSCAN Anomaly Engine status '{surge_status}' with deviation {surge_dev}."
                            if model_surge
                            else f"Arrival rate telemetry at {arr_rate:.0f} pts/hr."
                        ),
                        expected_operational_condition="Rapid influx of unannounced patients is expected to increase waiting queue pressure over the next hour.",
                        staff_review_guidance="Staff should review EMS ambulance diversion status, intake hallway registration readiness, and rapid triage staging.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # PATTERN 6: High Crowding Risk Persisting Despite Low/Improving Arrivals (Boarding/Exit Block)
        # Consumes Supervised XGBoost Classifier Output
        # ==============================================================================
        is_crowd_elevated = is_crowd_valid and (
            (crowding_score is not None and crowding_score >= th.crowding_score_warning)
            or (crowding_level in ["HIGH", "CRITICAL"])
        )
        is_low_inflow = arr_rate <= th.arrival_low_threshold
        is_high_occ = occ >= 70.0

        if is_crowd_elevated and is_low_inflow and is_high_occ:
            crowd_sev = "HIGH"
            rule_id = "RULE_PERSISTENT_CROWDING_STAGNATION"
            rule_exp = (
                f"Triggered by elevated crowding risk ({crowding_level}, score: {crowding_score:.0f}/100) "
                f"occurring despite low arrival rate ({arr_rate:.0f} pts/hr <= {th.arrival_low_threshold:.0f} pts/hr) "
                f"with occupancy at {occ:.0f}%. Indicates internal throughput/inpatient boarding bottleneck."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-persistent-crowding",
                    category="CROWDING",
                    severity=crowd_sev,
                    title="Persistent Crowding Risk Driven by Throughput Bottlenecks",
                    description=f"Crowding score is {crowding_score:.0f}/100 despite low arrival rate ({arr_rate:.0f} pts/hr). High occupancy ({occ:.0f}%) suggests internal inpatient boarding or transfer delays.",
                    affected_metrics=["crowding_score", "occupancy_percent", "arrival_rate"],
                )
            )

            stagnation_factors = [
                WorkloadFactor(name="XGBoost Crowding Classifier", impact="increases_pressure", contribution_score=crowding_score, detail=f"Crowding score {crowding_score}/100 ({crowding_level})"),
                WorkloadFactor(name="Low Inflow vs High Occupancy", impact="neutral", contribution_score=occ, detail=f"Arrivals are low ({arr_rate:.0f} /hr) but occupancy remains high ({occ:.0f}%)"),
            ]

            action_items = [
                "Audit hospital inpatient boarding times: assess admitted patients boarding in ED bays awaiting inpatient beds.",
                "Convene immediate discharge escalation with inpatient pharmacy and care management to clear inpatient floor beds.",
                "Review radiology and laboratory turnaround times for admitted patients holding in emergency bays.",
                "Expedite social work and transportation arrangements for pending patient discharges.",
            ]

            recommended_actions.append(
                RecommendationAction(
                    id="rec-persistent-crowding",
                    category="CROWDING",
                    priority=crowd_sev,
                    severity=crowd_sev,
                    title="Initiate Inpatient Boarding Escalation & Discharge Audit",
                    description=f"Department crowding ({crowding_score}/100) is persistent despite low patient arrivals ({arr_rate:.0f} pts/hr), indicating internal exit blocks.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics={
                        "crowding_score": crowding_score,
                        "crowding_level": crowding_level,
                        "arrival_rate": arr_rate,
                        "occupancy_percent": occ,
                    },
                    contributing_models=["Supervised XGBoost Classifier (Crowding Risk)"],
                    contributing_fields=["crowding_score", "crowding_level", "arrival_rate", "occupancy_percent"],
                    source_prediction="Supervised XGBoost Classifier (Crowding Risk)",
                    urgency="WITHIN 30 MIN",
                    due_in_minutes=30,
                    contributing_factors=stagnation_factors,
                    reason="Persistent crowding under low arrival velocity indicates internal throughput delays rather than intake overload.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon="Next 3 Hours",
                    required_resources=["Inpatient Care Management Liaison", "Inpatient Pharmacy Specialist", "Hospital Patient Placement"],
                    required_approvals=["Hospital Patient Flow Administrator", "Chief Medical Officer On-Call"],
                    action_status="NEW",
                    confidence=get_confidence("crowding_risk"),
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Persistent crowding was flagged because crowding model score ({crowding_score}/100) is elevated while inflow ({arr_rate:.0f} pts/hr) is low, pointing to inpatient boarding.",
                        contributing_factors=stagnation_factors,
                        strongest_influencer="Inpatient boarding duration and discharge turnover velocity.",
                        triggering_prediction=f"XGBoost Classifier crowding output {crowding_score}/100 ({crowding_level}).",
                        expected_operational_condition="Department bays will remain occupied by admitted boarders unless inpatient floor discharges are expedited.",
                        staff_review_guidance="Staff should review hospital inpatient transfer hold times, bed board status, and pharmacy discharge script readiness.",
                    ),
                    requires_human_review=True,
                    model_confidence=self.extract_native_confidence("crowding_risk", overview) if is_crowd_valid else None,
                )
            )

        # ==============================================================================
        # PATTERN 7: Upcoming Deep Learning Forecast Demand Peak
        # Consumes 2-Layer Keras LSTM Neural Network Output
        # ==============================================================================
        has_fc_peak = is_fc_valid and (
            (h3_arrivals is not None and h3_arrivals >= th.forecast_h3_warning)
            or (peak_rate is not None and peak_rate >= th.forecast_peak_rate_warning)
        )

        if has_fc_peak:
            fc_sev = "HIGH" if (h3_arrivals is not None and h3_arrivals >= th.forecast_h3_critical) else "MODERATE"
            rule_id = "RULE_LSTM_PEAK_FORECAST"
            rule_exp = (
                f"Triggered by 2-Layer LSTM Neural Network projection of {round(h3_arrivals) if h3_arrivals else 'elevated'} arrivals in next 3 hours "
                f"(threshold: >={th.forecast_h3_warning:.0f}) with peak arrival rate of {peak_rate:.0f} pts/hr at {peak_time}."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-forecast-demand",
                    category="FLOW",
                    severity=fc_sev,
                    title="Projected Arrival Influx Peak Ahead",
                    description=f"2-Layer LSTM forecast projects {round(h3_arrivals) if h3_arrivals else 'elevated'} patient arrivals over next 3 hours, peaking at {peak_rate:.0f} pts/hr around {peak_time}.",
                    affected_metrics=["predicted_3h_arrivals", "predicted_peak_rate"],
                )
            )

            forecast_factors = [
                WorkloadFactor(name="2-Layer Keras LSTM Network", impact="increases_pressure", contribution_score=h3_arrivals or 0.0, detail=f"{round(h3_arrivals) if h3_arrivals else 0} arrivals projected in next 3-hour window"),
                WorkloadFactor(name="Forecasted Peak Hour", impact="increases_pressure", contribution_score=peak_rate or 0.0, detail=f"Peak arrival rate of {peak_rate:.0f} pts/hr expected at {peak_time}"),
            ]

            action_items = [
                f"Pre-stage treatment bays and restock triage intake supply carts ahead of projected peak at {peak_time}.",
                "Verify telemetry monitor and portable ultrasound availability prior to the forecasted arrival window.",
                "Structure oncoming clinical shift handoffs to be completed before the forecasted arrival surge.",
                "Prepare rapid order sets and fast-track intake protocols for expected peak volume.",
            ]

            recommended_actions.append(
                RecommendationAction(
                    id="rec-forecast-staging",
                    category="FLOW",
                    priority=fc_sev,
                    severity=fc_sev,
                    title="Pre-Stage Treatment Bays & Restock Triage Supplies Ahead of Peak",
                    description=f"Deep learning LSTM model forecasts a peak inflow rate of {peak_rate:.0f} pts/hr around {peak_time}.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics={
                        "predicted_3h_arrivals": round(h3_arrivals) if h3_arrivals else None,
                        "predicted_peak_rate": peak_rate,
                        "predicted_peak_time": peak_time,
                        "forecast_trend": forecast_trend,
                    },
                    contributing_models=["2-Layer Keras LSTM Neural Network (Arrival Forecast)"],
                    contributing_fields=["predicted_3h_arrivals", "predicted_peak_rate", "predicted_peak_time", "forecast_trend"],
                    source_prediction="2-Layer Keras LSTM Neural Network",
                    urgency="WITHIN 1 HOUR",
                    due_in_minutes=45,
                    contributing_factors=forecast_factors,
                    reason="Proactive supply and space staging is projected to reduce bottleneck delays when the forecasted arrival peak occurs.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon="3h",
                    required_resources=["Triage Cart Supplies", "Point-of-Care Equipment", "Oncoming Shift Providers"],
                    required_approvals=["Emergency Department Nurse Manager"],
                    action_status="NEW",
                    confidence=get_confidence("forecast"),
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Upcoming demand surge was detected by the 2-Layer LSTM model predicting {round(h3_arrivals) if h3_arrivals else 'elevated'} arrivals over the next 3 hours.",
                        contributing_factors=forecast_factors,
                        strongest_influencer=f"LSTM neural network sequence analysis indicates a peak arrival rate of {peak_rate:.0f} pts/hr at {peak_time}.",
                        triggering_prediction=f"2-Layer Keras LSTM Neural Network 3-hour forecast ({round(h3_arrivals) if h3_arrivals else 'N/A'} arrivals, trend: {forecast_trend}).",
                        expected_operational_condition=f"Arrival velocity is projected to increase around {peak_time}, creating localized intake pressure.",
                        staff_review_guidance="Staff should review supply cart stocking, trauma bay readiness, and upcoming shift handoff preparations.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # PATTERN 8: Conflicting Indicators, Missing Data, or Degraded Predictions
        # ==============================================================================
        def _is_engine_success(k: str) -> bool:
            if k == "flow_pattern":
                return (eng_status.get("flow_pattern") in ["success", "demo"]) or (eng_status.get("flow_patterns") in ["success", "demo"])
            return eng_status.get(k) in ["success", "demo"]

        failed_or_missing_engines = [
            k for k in ["forecast", "waiting_time", "crowding_risk", "flow_pattern", "surge_detection"]
            if not _is_engine_success(k)
        ]
        has_failed_engine = degraded_mode or bool(failed_or_missing_engines)
        has_conflict = (waiting <= 5.0 and crowding_score is not None and crowding_score >= 80.0) or (arr_rate >= 40.0 and occ <= 20.0)

        if has_failed_engine or has_conflict:
            rule_id = "RULE_CONFLICTING_OR_DEGRADED_DATA"
            rule_exp = (
                f"Triggered by degraded/unavailable ML predictions (failed engines: {failed_or_missing_engines or 'none'}) "
                f"or divergent operational signals (waiting: {waiting:.0f}, crowding: {crowding_score or 'N/A'}, arrival: {arr_rate:.0f}, occupancy: {occ:.0f}%)."
            )

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-data-verification",
                    category="FLOW",
                    severity="MODERATE",
                    title="Operational Telemetry Verification Required",
                    description=(
                        f"Degraded or unavailable ML prediction engines ({', '.join(failed_or_missing_engines) if failed_or_missing_engines else 'divergent telemetry'}) "
                        f"require cross-referencing with manual department logs."
                    ),
                    affected_metrics=["ml_engine_status", "telemetry_integrity"],
                )
            )

            data_factors = [
                WorkloadFactor(name="Telemetry Feed / Engine Health", impact="neutral", contribution_score=50.0, detail=f"Engine status: {eng_status}"),
            ]

            action_items = [
                "Cross-reference department telemetry with manual ADT intake logs to verify sensor accuracy.",
                "Conduct manual physical census count of waiting room and treatment bays to resolve conflicting indicators.",
                "Notify technical operations/informatics team to inspect inference telemetry feeds and model pipeline.",
            ]

            recommended_actions.append(
                RecommendationAction(
                    id="rec-data-verification",
                    category="FLOW",
                    priority="MODERATE",
                    severity="MODERATE",
                    title="Cross-Reference Operational Telemetry with Manual Census Log",
                    description="Telemetry divergence or degraded inference engine detected; staff should verify physical department counts.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics={
                        "degraded_mode": degraded_mode or bool(failed_or_missing_engines),
                        "engine_status": eng_status,
                        "failed_engines": failed_or_missing_engines,
                        "patients_waiting": waiting,
                        "crowding_score": crowding_score,
                    },
                    contributing_models=[f"Unavailable/Degraded: {e}" for e in failed_or_missing_engines],
                    contributing_fields=["ml_engine_status", "degraded_mode"],
                    source_prediction="ERFlow System Reliability & Model Health Monitor",
                    urgency="WITHIN 1 HOUR",
                    due_in_minutes=60,
                    contributing_factors=data_factors,
                    reason="Preventing automated recommendations from relying on unverified divergent signals or degraded ML fallbacks.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon=None,
                    required_resources=["Manual ADT Intake Log", "Telemetry Service Monitor"],
                    required_approvals=["Charge Nurse", "ED Informatics Support"],
                    action_status="NEW",
                    confidence="LOW (DEGRADED)",
                    explanation_detail=ExplanationDetail(
                        detection_rationale="Telemetry divergence or model degraded status requires administrative physical verification.",
                        contributing_factors=data_factors,
                        strongest_influencer="Model status reporting degraded state or telemetry divergence.",
                        triggering_prediction=f"Engine status map: {eng_status}",
                        expected_operational_condition="Operations should rely on manual logging until data consistency is confirmed.",
                        staff_review_guidance="Verify manual intake clipboard count against electronic board count.",
                    ),
                    requires_human_review=True,
                )
            )

        # ==============================================================================
        # RECOVERY HYSTERESIS BUFFER CHECK
        # Prevents premature resolution of ongoing operational issues when metrics
        # improve below the initial warning threshold but have not reached the
        # full recovery threshold.
        # ==============================================================================
        active_candidates = {r.id for r in recommended_actions}

        # Check Bed Capacity Recovery Hysteresis
        if "rec-bed-capacity" in self._issue_history and self._issue_history["rec-bed-capacity"].get("active", False):
            if "rec-bed-capacity" not in active_candidates:
                # Issue did not trigger standard alerts, check if still within hysteresis buffer
                prev_peak_occ = self._issue_history["rec-bed-capacity"].get("peak_metric", 0.0)
                prev_min_beds = self._issue_history["rec-bed-capacity"].get("min_beds", 999.0)
                was_real_warning = (prev_peak_occ >= th.occupancy_warning) or (prev_min_beds <= th.available_beds_warning)

                is_occ_in_buffer = was_real_warning and (th.occupancy_recovery < occ < th.occupancy_warning)
                is_beds_in_buffer = was_real_warning and (th.available_beds_warning < beds < th.available_beds_recovery)
                if is_occ_in_buffer or is_beds_in_buffer:
                    prioritized_issues.append(
                        OperationalIssue(
                            id="iss-bed-capacity",
                            category="BED CAPACITY",
                            severity="MODERATE",
                            title="Bed Capacity Recovery In Progress — Hysteresis Monitoring",
                            description=(
                                f"Bed occupancy ({occ:.0f}%) and available beds ({beds:.0f}) have improved below warning thresholds, "
                                f"but remain within the operational recovery buffer (recovery targets: <={th.occupancy_recovery:.0f}% occ, >={th.available_beds_recovery:.0f} beds)."
                            ),
                            affected_metrics=["occupancy_percent", "available_beds"],
                        )
                    )
                    recovery_factors = [
                        WorkloadFactor(name="Occupancy Recovery Buffer", impact="neutral", contribution_score=occ, detail=f"Occupancy {occ:.0f}% in recovery buffer (target <= {th.occupancy_recovery:.0f}%)"),
                        WorkloadFactor(name="Available Beds Buffer", impact="neutral", contribution_score=beds, detail=f"Available beds {beds:.0f} in recovery buffer (target >= {th.available_beds_recovery:.0f})"),
                    ]
                    recovery_actions = [
                        "Maintain active inpatient bed coordination and monitor turnover velocity until metrics pass recovery threshold.",
                        "Inspect flex bays and discharge holding areas before de-authorizing operational surge assignments.",
                    ]
                    recommended_actions.append(
                        RecommendationAction(
                            id="rec-bed-capacity",
                            category="BED CAPACITY",
                            priority="MODERATE",
                            severity="MODERATE",
                            title="Monitor Bed Turnover Buffer & Prepare De-Escalation",
                            description=f"Department bed capacity is stabilizing (occ: {occ:.0f}%, beds: {beds:.0f}). Staff should maintain active turnover until sustained recovery is confirmed.",
                            recommended_action=recovery_actions[0],
                            recommended_actions=recovery_actions,
                            contributing_metrics={"occupancy_percent": occ, "available_beds": beds, "recovery_phase": "HYSTERESIS_BUFFER"},
                            contributing_models=["Department Bed Telemetry (Hysteresis Buffer)"],
                            contributing_fields=["occupancy_percent", "available_beds"],
                            source_prediction="ERFlow Recovery Hysteresis Buffer Monitor",
                            urgency="WITHIN 1 HOUR",
                            due_in_minutes=60,
                            contributing_factors=recovery_factors,
                            reason=f"Metrics have improved past initial warning threshold but remain within operational hysteresis buffer (>={th.occupancy_recovery:.0f}%). Human review or sustained clearing required to resolve.",
                            rule_id="RULE_HYSTERESIS_BED_RECOVERY",
                            rule_explanation=f"Occupancy ({occ:.0f}%) or available beds ({beds:.0f}) remains within hysteresis buffer ({th.occupancy_recovery:.0f}%-{th.occupancy_warning:.0f}% occ, {th.available_beds_warning:.0f}-{th.available_beds_recovery:.0f} beds).",
                            forecast_horizon=None,
                            required_resources=["Bed Command Coordinator", "Floor Charge Nurse"],
                            required_approvals=["Charge Nurse Authorization"],
                            action_status="NEW",
                            confidence="HIGH",
                            explanation_detail=ExplanationDetail(
                                detection_rationale=f"Bed recovery pending because occupancy ({occ:.0f}%) or beds ({beds:.0f}) has not passed the recovery benchmark.",
                                contributing_factors=recovery_factors,
                                strongest_influencer="Hysteresis buffer prevents premature issue resolution and alert flapping.",
                                triggering_prediction="Live telemetry within operational hysteresis buffer.",
                                expected_operational_condition="Operations are stabilizing; premature relaxation of bed placement efforts may trigger recurrence.",
                                staff_review_guidance="Verify physical room turnover and ensure admitted boarding census continues to decrease.",
                            ),
                            requires_human_review=True,
                            priority_score=0.0,
                            model_confidence=None,
                            issue_trend="RECOVERY_PENDING",
                            escalation_detected=False,
                            requires_human_confirmation_to_resolve=True,
                            historical_occurrence_count=self._issue_history["rec-bed-capacity"].get("occurrence_count", 1),
                        )
                    )

        # Check Triage Queue Recovery Hysteresis
        if "rec-triage-capacity" in self._issue_history and self._issue_history["rec-triage-capacity"].get("active", False):
            if "rec-triage-capacity" not in active_candidates:
                is_queue_in_buffer = waiting > th.queue_recovery
                is_wait_in_buffer = (wait_min is not None and wait_min > th.wait_time_recovery)
                if is_queue_in_buffer or is_wait_in_buffer:
                    prioritized_issues.append(
                        OperationalIssue(
                            id="iss-waiting-queue",
                            category="WAITING QUEUE",
                            severity="MODERATE",
                            title="Triage Queue Recovery In Progress — Hysteresis Monitoring",
                            description=(
                                f"Queue length ({waiting:.0f} pts) has improved below warning threshold ({th.queue_warning:.0f}), "
                                f"but remains within the recovery buffer (target: <={th.queue_recovery:.0f} pts)."
                            ),
                            affected_metrics=["patients_waiting"],
                        )
                    )
                    q_recovery_actions = [
                        "Continue auxiliary triage intake until waiting queue stabilizes below recovery threshold.",
                        "Reassess remaining waiting room patients before de-escalating triage staffing.",
                    ]
                    recommended_actions.append(
                        RecommendationAction(
                            id="rec-triage-capacity",
                            category="TRIAGE CAPACITY",
                            priority="MODERATE",
                            severity="MODERATE",
                            title="Monitor Triage Decongest Buffer & Reassess Queue",
                            description=f"Triage queue is stabilizing ({waiting:.0f} pts). Staff should maintain auxiliary screening until sustained clearance is confirmed.",
                            recommended_action=q_recovery_actions[0],
                            recommended_actions=q_recovery_actions,
                            contributing_metrics={"patients_waiting": waiting, "recovery_phase": "HYSTERESIS_BUFFER"},
                            contributing_models=["Triage Telemetry Queue (Hysteresis Buffer)"],
                            contributing_fields=["patients_waiting"],
                            source_prediction="ERFlow Recovery Hysteresis Buffer Monitor",
                            urgency="WITHIN 1 HOUR",
                            due_in_minutes=60,
                            contributing_factors=[
                                WorkloadFactor(name="Queue Recovery Buffer", impact="neutral", contribution_score=waiting, detail=f"Queue length {waiting:.0f} in buffer (target <= {th.queue_recovery:.0f})")
                            ],
                            reason=f"Queue length has decreased past initial warning threshold but remains within recovery hysteresis buffer (>={th.queue_recovery:.0f} pts).",
                            rule_id="RULE_HYSTERESIS_QUEUE_RECOVERY",
                            rule_explanation=f"Queue length ({waiting:.0f} pts) remains within hysteresis buffer ({th.queue_recovery:.0f}-{th.queue_warning:.0f} pts).",
                            forecast_horizon="1h",
                            required_resources=["Triage Charge Nurse"],
                            required_approvals=["Charge Nurse Authorization"],
                            action_status="NEW",
                            confidence="HIGH",
                            explanation_detail=ExplanationDetail(
                                detection_rationale=f"Queue recovery pending because waiting queue count ({waiting:.0f} pts) has not passed the recovery benchmark ({th.queue_recovery:.0f} pts).",
                                contributing_factors=[WorkloadFactor(name="Queue Buffer", impact="neutral", contribution_score=waiting, detail="Queue in buffer")],
                                strongest_influencer="Hysteresis buffer prevents premature triage closure.",
                                triggering_prediction="Active triage queue telemetry.",
                                expected_operational_condition="Queue volume is normalizing.",
                                staff_review_guidance="Maintain fast-track intake until queue remains firmly below 14 patients.",
                            ),
                            requires_human_review=True,
                            priority_score=0.0,
                            model_confidence=None,
                            issue_trend="RECOVERY_PENDING",
                            escalation_detected=False,
                            requires_human_confirmation_to_resolve=True,
                            historical_occurrence_count=self._issue_history["rec-triage-capacity"].get("occurrence_count", 1),
                        )
                    )

        # Check Staffing Saturation Recovery Hysteresis
        if "rec-staffing-allocation" in self._issue_history and self._issue_history["rec-staffing-allocation"].get("active", False):
            if "rec-staffing-allocation" not in active_candidates:
                is_doc_in_buffer = doc_load_ratio > th.doc_load_recovery
                is_nurse_in_buffer = nurse_load_ratio > th.nurse_load_recovery
                if is_doc_in_buffer or is_nurse_in_buffer:
                    prioritized_issues.append(
                        OperationalIssue(
                            id="iss-staffing-strain",
                            category="STAFFING",
                            severity="MODERATE",
                            title="Staff Workload Recovery In Progress — Hysteresis Monitoring",
                            description=(
                                f"Workload ratios ({doc_load_ratio} pts/MD, {nurse_load_ratio} pts/RN) have improved below warning thresholds, "
                                f"but remain within recovery buffer (targets: <={th.doc_load_recovery} pts/MD, <={th.nurse_load_recovery} pts/RN)."
                            ),
                            affected_metrics=["doctor_load_ratio", "nurse_load_ratio"],
                        )
                    )
                    staff_rec_actions = [
                        "Maintain current provider shift coverage until staffing ratios stabilize below baseline targets.",
                        "Re-evaluate mid-level provider assignments before releasing float support.",
                    ]
                    recommended_actions.append(
                        RecommendationAction(
                            id="rec-staffing-allocation",
                            category="STAFFING",
                            priority="MODERATE",
                            severity="MODERATE",
                            title="Monitor Staff Ratio Buffer Before De-Escalating Coverage",
                            description=f"Staff ratios are improving ({doc_load_ratio} pts/MD, {nurse_load_ratio} pts/RN). Staff should maintain current assignments until sustained ratio recovery is achieved.",
                            recommended_action=staff_rec_actions[0],
                            recommended_actions=staff_rec_actions,
                            contributing_metrics={"doctor_load_ratio": doc_load_ratio, "nurse_load_ratio": nurse_load_ratio, "recovery_phase": "HYSTERESIS_BUFFER"},
                            contributing_models=["Department Workload Ratio Analysis (Hysteresis Buffer)"],
                            contributing_fields=["doctor_load_ratio", "nurse_load_ratio"],
                            source_prediction="ERFlow Recovery Hysteresis Buffer Monitor",
                            urgency="WITHIN 1 HOUR",
                            due_in_minutes=60,
                            contributing_factors=[
                                WorkloadFactor(name="Staff Ratio Buffer", impact="neutral", contribution_score=doc_load_ratio, detail=f"Ratios in buffer ({doc_load_ratio} MD, {nurse_load_ratio} RN)")
                            ],
                            reason="Staff workload ratios are improving but remain within hysteresis buffer above target baselines.",
                            rule_id="RULE_HYSTERESIS_STAFF_RECOVERY",
                            rule_explanation=f"Doctor load ({doc_load_ratio}) or nurse load ({nurse_load_ratio}) remains within hysteresis buffer.",
                            forecast_horizon=None,
                            required_resources=["Current Floor Nursing", "Active Providers"],
                            required_approvals=["Charge Nurse Authorization"],
                            action_status="NEW",
                            confidence="HIGH",
                            explanation_detail=ExplanationDetail(
                                detection_rationale="Staff workload recovery pending ratio stabilization.",
                                contributing_factors=[WorkloadFactor(name="Staff Buffer", impact="neutral", contribution_score=50.0, detail="Staffing ratios in buffer")],
                                strongest_influencer="Provider-to-patient ratio buffer.",
                                triggering_prediction="Active staffing telemetry.",
                                expected_operational_condition="Staff strain is normalizing.",
                                staff_review_guidance="Confirm provider handoffs are orderly before de-authorizing float coverage.",
                            ),
                            requires_human_review=True,
                            priority_score=0.0,
                            model_confidence=None,
                            issue_trend="RECOVERY_PENDING",
                            escalation_detected=False,
                            requires_human_confirmation_to_resolve=True,
                            historical_occurrence_count=self._issue_history["rec-staffing-allocation"].get("occurrence_count", 1),
                        )
                    )

        # Check Arrival Surge Recovery Hysteresis
        if "rec-surge-mitigation" in self._issue_history and self._issue_history["rec-surge-mitigation"].get("active", False):
            if "rec-surge-mitigation" not in active_candidates:
                if arr_rate > th.arrival_recovery:
                    prioritized_issues.append(
                        OperationalIssue(
                            id="iss-arrival-surge",
                            category="SURGE",
                            severity="MODERATE",
                            title="Arrival Surge Recovery In Progress — Inflow Monitoring",
                            description=f"Arrival velocity has dropped to {arr_rate:.0f} pts/hr but remains within recovery buffer (target: <={th.arrival_recovery:.0f} pts/hr).",
                            affected_metrics=["arrival_rate"],
                        )
                    )
                    surge_rec_actions = [
                        "Monitor hourly intake rate to ensure arrival velocity remains below surge baseline.",
                        "Notify EMS coordinator of stabilizing status while maintaining auxiliary registration readiness.",
                    ]
                    recommended_actions.append(
                        RecommendationAction(
                            id="rec-surge-mitigation",
                            category="ARRIVAL PRESSURE",
                            priority="MODERATE",
                            severity="MODERATE",
                            title="Monitor Arrival Velocity Buffer & Stand Down Surge Protocol",
                            description=f"Arrival velocity is normalizing ({arr_rate:.0f} pts/hr). Staff should monitor inflow rate before fully standing down surge protocols.",
                            recommended_action=surge_rec_actions[0],
                            recommended_actions=surge_rec_actions,
                            contributing_metrics={"arrival_rate": arr_rate, "recovery_phase": "HYSTERESIS_BUFFER"},
                            contributing_models=["Arrival Telemetry Rate Monitor"],
                            contributing_fields=["arrival_rate"],
                            source_prediction="ERFlow Recovery Hysteresis Buffer Monitor",
                            urgency="WITHIN 1 HOUR",
                            due_in_minutes=60,
                            contributing_factors=[WorkloadFactor(name="Arrival Inflow Buffer", impact="neutral", contribution_score=arr_rate, detail=f"Arrivals {arr_rate:.0f} pts/hr")],
                            reason=f"Arrival velocity has decreased past initial warning threshold but remains within recovery hysteresis buffer (>={th.arrival_recovery:.0f} pts/hr).",
                            rule_id="RULE_HYSTERESIS_SURGE_RECOVERY",
                            rule_explanation=f"Arrival velocity ({arr_rate:.0f} pts/hr) remains within hysteresis buffer ({th.arrival_recovery:.0f}-{th.arrival_critical:.0f} pts/hr).",
                            forecast_horizon="1h",
                            required_resources=["Triage Registration"],
                            required_approvals=["Charge Nurse Authorization"],
                            action_status="NEW",
                            confidence="HIGH",
                            explanation_detail=ExplanationDetail(
                                detection_rationale="Arrival surge recovery pending inflow normalization.",
                                contributing_factors=[WorkloadFactor(name="Arrival Buffer", impact="neutral", contribution_score=arr_rate, detail="Arrivals in buffer")],
                                strongest_influencer="Arrival velocity buffer.",
                                triggering_prediction="Live arrival rate telemetry.",
                                expected_operational_condition="Arrival pressure is stabilizing.",
                                staff_review_guidance="Maintain registration readiness until arrival velocity drops firmly below 22 pts/hr.",
                            ),
                            requires_human_review=True,
                            priority_score=0.0,
                            model_confidence=None,
                            issue_trend="RECOVERY_PENDING",
                            escalation_detected=False,
                            requires_human_confirmation_to_resolve=True,
                            historical_occurrence_count=self._issue_history["rec-surge-mitigation"].get("occurrence_count", 1),
                        )
                    )

        # ==============================================================================
        # PATTERN 9: Baseline Stable Condition (No Alerts Flagged)
        # ==============================================================================
        if not prioritized_issues:
            rule_id = "RULE_BASELINE_STABLE"
            rule_exp = f"Evaluated all operational rules against occupancy ({occ:.0f}%), queue ({waiting:.0f}), arrivals ({arr_rate:.0f}); all metrics within normal thresholds."

            prioritized_issues.append(
                OperationalIssue(
                    id="iss-baseline-stable",
                    category="FLOW",
                    severity="LOW",
                    title="Department Operations Stable Within Normal Baselines",
                    description=f"Current occupancy ({occ:.0f}%), queue length ({waiting:.0f} pts), and arrival velocity ({arr_rate:.0f} pts/hr) are stable.",
                    affected_metrics=["occupancy_percent", "patients_waiting"],
                )
            )

            stable_factors = [
                WorkloadFactor(name="Operational Baseline", impact="neutral", contribution_score=0.0, detail="All telemetry metrics within standard operating bounds"),
            ]

            action_items = [
                "Maintain routine operational monitoring and standard nurse-patient staffing ratios.",
                "Perform scheduled supply restocking and equipment calibration checks.",
                "Continue regular live telemetry monitoring across shift.",
            ]

            valid_models = [k for k in ["forecast", "waiting_time", "crowding_risk", "flow_pattern", "surge_detection"] if eng_status.get(k) in ["success", "demo"]]

            flow_conf = self.extract_native_confidence("flow_pattern", overview) if is_flow_valid else None

            recommended_actions.append(
                RecommendationAction(
                    id="rec-baseline-maintenance",
                    category="FLOW",
                    priority="LOW",
                    severity="LOW",
                    title="Maintain Standard Operational Protocol & Monitor Telemetry",
                    description="All available ML prediction engines and telemetry feeds report baseline department throughput.",
                    recommended_action=action_items[0],
                    recommended_actions=action_items,
                    contributing_metrics={
                        "occupancy_percent": occ,
                        "patients_waiting": waiting,
                        "arrival_rate": arr_rate,
                        "available_beds": beds,
                    },
                    contributing_models=valid_models,
                    contributing_fields=["occupancy_percent", "patients_waiting", "arrival_rate", "available_beds"],
                    source_prediction="Unified Multi-Model Operating Baseline",
                    urgency="NEXT SHIFT",
                    due_in_minutes=120,
                    contributing_factors=stable_factors,
                    reason="No immediate capacity or staffing bottlenecks detected by ML inference models.",
                    rule_id=rule_id,
                    rule_explanation=rule_exp,
                    forecast_horizon=None,
                    required_resources=["Standard Floor Staffing"],
                    required_approvals=["Charge Nurse Routine Oversight"],
                    action_status="NEW",
                    confidence="HIGH",
                    explanation_detail=ExplanationDetail(
                        detection_rationale=f"Baseline stability was confirmed as occupancy ({occ:.0f}%) and queue length ({waiting:.0f} pts) remain within normal parameters.",
                        contributing_factors=stable_factors,
                        strongest_influencer="All telemetry feeds and ML models reflect baseline operating conditions.",
                        triggering_prediction="Unified multi-model inference evaluation reporting normal load.",
                        expected_operational_condition="Department throughput is projected to remain stable over the upcoming window.",
                        staff_review_guidance="Staff should maintain routine shift operations and monitor live telemetry.",
                    ),
                    requires_human_review=True,
                    priority_score=0.0,
                    model_confidence=flow_conf,
                    issue_trend="NEW",
                    escalation_detected=False,
                    requires_human_confirmation_to_resolve=False,
                    historical_occurrence_count=1,
                )
            )

        # ==============================================================================
        # MERGE OVERLAPPING RECOMMENDATIONS & DEDUPLICATE
        # ==============================================================================
        merged_actions = self.merge_recommendations(recommended_actions)
        merged_issues = self.merge_issues(prioritized_issues)

        # ==============================================================================
        # DYNAMIC PRIORITIZATION & LIFECYCLE TRACKING
        # ==============================================================================
        act_statuses = action_statuses or {}
        pw = prioritization_weights or self.prioritization_weights

        for rec in merged_actions:
            current_status = act_statuses.get(rec.id, rec.action_status or "NEW")
            rec.action_status = current_status

            prev_entry = self._issue_history.get(rec.id)
            if not prev_entry or prev_entry.get("resolved", False):
                if prev_entry and prev_entry.get("resolved", False):
                    rec.issue_trend = "RECURRENCE"
                    rec.historical_occurrence_count = prev_entry.get("occurrence_count", 1) + 1
                else:
                    if not rec.issue_trend:
                        rec.issue_trend = "NEW"
                    rec.historical_occurrence_count = 1
                rec.escalation_detected = False
            else:
                # Currently active from previous cycle
                if rec.issue_trend == "RECOVERY_PENDING":
                    rec.escalation_detected = False
                    rec.historical_occurrence_count = prev_entry.get("occurrence_count", 1)
                else:
                    curr_val = SEVERITY_ORDER.get(rec.severity.upper(), 1)
                    prev_val = SEVERITY_ORDER.get(prev_entry.get("severity", "LOW").upper(), 1)
                    if curr_val > prev_val:
                        rec.issue_trend = "ESCALATING"
                        rec.escalation_detected = True
                    elif curr_val < prev_val:
                        rec.issue_trend = "DE-ESCALATING"
                        rec.escalation_detected = False
                    else:
                        rec.issue_trend = "STABLE"
                        rec.escalation_detected = False
                    rec.historical_occurrence_count = prev_entry.get("occurrence_count", 1)

            # Calculate deterministic priority score
            rec.priority_score = self.calculate_priority_score(
                rec=rec,
                weights=pw,
                action_status=rec.action_status,
                signal_reliability=rec.confidence,
            )

        # ==============================================================================
        # DETERMINISTIC MULTI-KEY SORTING
        # Multi-key: (-priority_score, -severity_rank, due_in_minutes, id)
        # ==============================================================================
        merged_actions.sort(
            key=lambda r: (
                -round(r.priority_score, 2),
                -SEVERITY_ORDER.get(r.severity.upper(), 0),
                r.due_in_minutes,
                r.id,
            )
        )

        # Align prioritized_issues with sorted recommended_actions
        rec_id_rank = {r.id: idx for idx, r in enumerate(merged_actions)}

        def issue_sort_key(iss: OperationalIssue) -> Tuple[int, str]:
            mapped_rec = iss.id.replace("iss-", "rec-")
            if mapped_rec in rec_id_rank:
                return (rec_id_rank[mapped_rec], iss.id)
            if iss.id == "iss-bed-deficit" and "rec-bed-capacity" in rec_id_rank:
                return (rec_id_rank["rec-bed-capacity"], iss.id)
            return (999, iss.id)

        merged_issues.sort(key=issue_sort_key)

        # ==============================================================================
        # UPDATE ACTIVE ISSUE REGISTRY SNAPSHOT
        # ==============================================================================
        current_active_ids = {r.id for r in merged_actions}
        for r in merged_actions:
            entry = self._issue_history.setdefault(r.id, {})
            entry.update({
                "active": True,
                "resolved": False,
                "severity": r.severity,
                "priority_score": r.priority_score,
                "occurrence_count": r.historical_occurrence_count,
                "trend": r.issue_trend,
            })
            if r.id == "rec-bed-capacity":
                entry["peak_metric"] = max(entry.get("peak_metric", 0.0), occ)
                entry["min_beds"] = min(entry.get("min_beds", beds), beds)
            elif r.id == "rec-triage-capacity":
                entry["peak_metric"] = max(entry.get("peak_metric", 0.0), waiting)
            elif r.id == "rec-staffing-allocation":
                entry["peak_doc_load"] = max(entry.get("peak_doc_load", 0.0), doc_load_ratio)
                entry["peak_nurse_load"] = max(entry.get("peak_nurse_load", 0.0), nurse_load_ratio)
            elif r.id == "rec-surge-mitigation":
                entry["peak_metric"] = max(entry.get("peak_metric", 0.0), arr_rate)
            elif r.id == "rec-persistent-crowding":
                entry["peak_metric"] = max(entry.get("peak_metric", 0.0), crowding_score or 0.0)

        # Any previously active issue not in current active set is now resolved
        for prev_id, prev_data in self._issue_history.items():
            if prev_id not in current_active_ids and prev_data.get("active", False):
                prev_data["active"] = False
                prev_data["resolved"] = True
                prev_data.pop("peak_metric", None)
                prev_data.pop("min_beds", None)
                prev_data.pop("peak_doc_load", None)
                prev_data.pop("peak_nurse_load", None)

        return merged_issues, merged_actions


recommendation_engine = EDRecommendationEngine()
