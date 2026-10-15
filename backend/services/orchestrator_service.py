import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from ..schemas.hospital_state import HospitalState
from ..schemas.orchestrator import (
    OrchestratorResponse,
    WorkloadAssessment,
    OperationalIssue,
    RecommendationAction,
    WorkloadFactor,
    ExplanationDetail,
)
from ..schemas.overview import DashboardOverviewResponse
from .overview_service import overview_service
from .recommendation_engine import recommendation_engine

logger = logging.getLogger("erflow.orchestrator_service")


class EDCommandOrchestratorService:
    """
    ED Command & Workload Orchestrator Engine.
    Evaluates real operational telemetry and consumes real outputs from all 5 ML models
    (LSTM forecast, XGBoost Regressor, XGBoost Classifier, K-Means, DBSCAN) to generate
    an aggregated operational command state, staffing strain assessment, prioritized issues,
    and department-level resource allocation recommendations with full XAI explainability.
    """

    def analyze_operations(
        self,
        state: HospitalState,
        overview: Optional[DashboardOverviewResponse] = None,
    ) -> OrchestratorResponse:
        req_id = f"orch-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.now(timezone.utc).isoformat()
        logger.info(f"[{req_id}] Initiating ED Command Orchestrator evaluation with centralized prediction workflow...")

        # 1. Consume REAL outputs from existing multi-model overview service or reuse passed predictions
        if overview is not None:
            engine_status = overview.engine_status or {
                "forecast": "success" if getattr(overview, "forecast", None) else "unavailable",
                "waiting_time": "success" if getattr(overview, "waiting_time", None) else "unavailable",
                "crowding_risk": "success" if getattr(overview, "crowding_risk", None) else "unavailable",
                "flow_pattern": "success" if getattr(overview, "flow_pattern", None) else "unavailable",
                "surge_detection": "success" if getattr(overview, "surge_detection", None) else "unavailable",
            }
        else:
            try:
                overview = overview_service.get_overview(state)
                engine_status = overview.engine_status or {
                    "forecast": "success",
                    "waiting_time": "success",
                    "crowding_risk": "success",
                    "flow_pattern": "success",
                    "surge_detection": "success",
                }
            except Exception as e:
                logger.error(f"[{req_id}] Error invoking overview service in orchestrator: {e}", exc_info=True)
                engine_status = {
                    "forecast": "failed",
                    "waiting_time": "failed",
                    "crowding_risk": "failed",
                    "flow_pattern": "failed",
                    "surge_detection": "failed",
                }
                overview = None

        degraded_mode = any(status not in ["success", "demo"] for status in engine_status.values())
        if degraded_mode:
            logger.warning(f"[{req_id}] Orchestrator operating in DEGRADED MODE. Engine statuses: {engine_status}")

        # 2. Extract operational variables & handle missing ML outputs gracefully
        occ = float(getattr(state, "occupancy_percent", 78.0) or 0.0)
        waiting = float(getattr(state, "patients_waiting", 24.0) or 0.0)
        beds = float(getattr(state, "available_beds", 8.0) or 0.0)
        arr_rate = float(getattr(state, "arrival_rate", 28.0) or 0.0)
        acuity = float(getattr(state, "severity_level", 3.0) or 3.0)
        docs = max(1.0, float(getattr(state, "available_doctors", 5.0) or 1.0))
        nurses = max(1.0, float(getattr(state, "available_nurses", 9.0) or 1.0))

        # Check validity of each ML engine independently
        is_fc_valid = (
            engine_status.get("forecast") in ["success", "demo"]
            and getattr(overview, "forecast", None) is not None
            and getattr(getattr(overview, "forecast", None), "error", None) is None
        )
        forecast_obj = getattr(overview, "forecast", None) if is_fc_valid else None
        h3_arrivals = (
            float(forecast_obj.horizons.get("3h"))
            if forecast_obj and forecast_obj.horizons and "3h" in forecast_obj.horizons
            else None
        )
        peak_rate = float(forecast_obj.predicted_peak_rate) if forecast_obj and getattr(forecast_obj, "predicted_peak_rate", None) is not None else None
        peak_time = forecast_obj.predicted_peak_time if forecast_obj and getattr(forecast_obj, "predicted_peak_time", None) else "Upcoming Peak"
        forecast_trend = forecast_obj.trend if forecast_obj and getattr(forecast_obj, "trend", None) else "Stable"

        is_wt_valid = (
            engine_status.get("waiting_time") in ["success", "demo"]
            and getattr(overview, "waiting_time", None) is not None
            and getattr(getattr(overview, "waiting_time", None), "error", None) is None
        )
        wt_obj = getattr(overview, "waiting_time", None) if is_wt_valid else None
        wait_min = float(wt_obj.waiting_time_minutes) if wt_obj and getattr(wt_obj, "waiting_time_minutes", None) is not None else None

        is_crowd_valid = (
            engine_status.get("crowding_risk") in ["success", "demo"]
            and getattr(overview, "crowding_risk", None) is not None
            and getattr(getattr(overview, "crowding_risk", None), "error", None) is None
        )
        crowd_obj = getattr(overview, "crowding_risk", None) if is_crowd_valid else None
        crowding_score = float(crowd_obj.crowding_score) if crowd_obj and getattr(crowd_obj, "crowding_score", None) is not None else None
        crowding_level = crowd_obj.crowding_level.upper() if crowd_obj and getattr(crowd_obj, "crowding_level", None) else None

        is_surge_valid = (
            engine_status.get("surge_detection") in ["success", "demo"]
            and getattr(overview, "surge_detection", None) is not None
            and getattr(getattr(overview, "surge_detection", None), "error", None) is None
        )
        surge_obj = getattr(overview, "surge_detection", None) if is_surge_valid else None
        is_surge = bool(surge_obj.is_surge) if surge_obj and getattr(surge_obj, "is_surge", None) is not None else None

        # 3. Calculate Workload Assessment & Staff Ratios
        doc_load_ratio = round(waiting / docs, 1)
        occupied_beds_est = max(0.0, (occ / 100.0) * 35.0)
        nurse_load_ratio = round((waiting + occupied_beds_est) / nurses, 1)

        # 4. Calculate Composite Overall ER Pressure Score (0 - 100)
        # Dynamically normalize weights across valid components so missing predictions are NEVER treated as zero
        weighted_sum = 0.0
        total_weight = 0.0

        # Occupancy component (telemetry)
        occ_weight = 0.25
        weighted_sum += occ_weight * occ
        total_weight += occ_weight

        # Staff factor component (telemetry)
        staff_factor = min(100.0, max(0.0, (doc_load_ratio - 3.0) * 15.0 + (nurse_load_ratio - 5.0) * 10.0))
        staff_weight = 0.15
        weighted_sum += staff_weight * staff_factor
        total_weight += staff_weight

        # Crowding risk component (XGBoost Classifier)
        if is_crowd_valid and crowding_score is not None:
            crowd_weight = 0.30
            weighted_sum += crowd_weight * crowding_score
            total_weight += crowd_weight

        # Waiting time component (XGBoost Regressor)
        if is_wt_valid and wait_min is not None:
            wait_factor = min(100.0, (wait_min / 90.0) * 100.0)
            wait_weight = 0.20
            weighted_sum += wait_weight * wait_factor
            total_weight += wait_weight

        # Surge anomaly component (DBSCAN Anomaly Detector or Telemetry Spike)
        if is_surge_valid and is_surge is not None:
            surge_weight = 0.10
            surge_val = 100.0 if is_surge else 0.0
            weighted_sum += surge_weight * surge_val
            total_weight += surge_weight
        elif arr_rate > 35.0:
            surge_weight = 0.10
            weighted_sum += surge_weight * 70.0
            total_weight += surge_weight

        composite_score = (weighted_sum / total_weight) if total_weight > 0 else occ
        overall_pressure_score = round(min(100.0, max(0.0, composite_score)), 1)

        # Map pressure score to pressure level
        if overall_pressure_score >= 78.0 or crowding_level == "CRITICAL":
            pressure_level = "CRITICAL"
        elif overall_pressure_score >= 58.0 or crowding_level == "HIGH":
            pressure_level = "HIGH"
        elif overall_pressure_score >= 35.0:
            pressure_level = "MODERATE"
        else:
            pressure_level = "LOW"

        # Determine upcoming 3h workload forecast level
        if (h3_arrivals is not None and h3_arrivals > 45) or (peak_rate is not None and peak_rate > 32) or (is_surge and pressure_level in ["HIGH", "CRITICAL"]):
            upcoming_level = "CRITICAL"
        elif (h3_arrivals is not None and h3_arrivals > 32) or forecast_trend == "Increasing" or pressure_level in ["HIGH", "CRITICAL"]:
            upcoming_level = "HIGH"
        elif (h3_arrivals is not None and h3_arrivals > 20) or arr_rate > 24:
            upcoming_level = "MODERATE"
        else:
            upcoming_level = "LOW"

        forecast_summary_part = (
            f"Model projections indicate a 3-hour arrival volume of {round(h3_arrivals)} patients with a {upcoming_level.lower()} workload trajectory."
            if h3_arrivals is not None
            else f"Current arrival velocity stands at {arr_rate:.0f} pts/hr with a {upcoming_level.lower()} workload trajectory."
        )

        workload_summary = (
            f"Department pressure is associated with a {pressure_level} index ({overall_pressure_score}/100). "
            f"Physician workload ratio is {doc_load_ratio} pts/MD and nursing load ratio is {nurse_load_ratio} active pts/RN. "
            f"{forecast_summary_part}"
        )

        workload_assessment = WorkloadAssessment(
            doctor_load_ratio=doc_load_ratio,
            nurse_load_ratio=nurse_load_ratio,
            bed_occupancy_percent=occ,
            current_workload_level=pressure_level,
            upcoming_3h_workload_level=upcoming_level,
            summary=workload_summary,
        )

        # Check existing action statuses from Action Queue store to factor into dynamic prioritization
        action_statuses = {}
        try:
            from .action_queue_service import action_queue_service
            action_statuses = {item_id: item.status.value for item_id, item in action_queue_service._actions.items()}
        except Exception as e:
            logger.debug(f"Could not load action statuses for prioritization: {e}")

        # 5. Evaluate Operational Patterns & Build Prioritized Issues & Recommendations via Dynamic Engine
        prioritized_issues, recommended_actions = recommendation_engine.evaluate_rules(
            state=state,
            overview=overview,
            engine_status=engine_status,
            degraded_mode=degraded_mode,
            action_statuses=action_statuses,
        )

        # 6. Assemble Data Sources Used: NEVER claim an engine contributed if it was unavailable or failed
        data_sources_used = ["HospitalState Telemetry Feed"]
        if engine_status.get("forecast") in ["success", "demo"] and is_fc_valid:
            data_sources_used.append("2-Layer Keras LSTM Neural Network (Arrival Forecast)")
        if engine_status.get("waiting_time") in ["success", "demo"] and is_wt_valid:
            data_sources_used.append("Supervised XGBoost Regressor (Waiting Time)")
        if engine_status.get("crowding_risk") in ["success", "demo"] and is_crowd_valid:
            data_sources_used.append("Supervised XGBoost Classifier (Crowding Risk)")
        if engine_status.get("flow_pattern") in ["success", "demo"]:
            data_sources_used.append("Unsupervised K-Means + PCA (Flow Pattern)")
        if engine_status.get("surge_detection") in ["success", "demo"] and is_surge_valid:
            data_sources_used.append("Unsupervised DBSCAN (Surge Anomaly Detector)")
        if (is_wt_valid or is_crowd_valid):
            data_sources_used.append("TreeSHAP Feature Attribution Layer (xai_explainer.py)")

        return OrchestratorResponse(
            overall_pressure_score=overall_pressure_score,
            pressure_level=pressure_level,
            workload_assessment=workload_assessment,
            prioritized_issues=prioritized_issues,
            recommended_actions=recommended_actions,
            ml_engine_status=engine_status,
            degraded_mode=degraded_mode,
            data_sources_used=data_sources_used,
            request_id=req_id,
            timestamp=now_iso,
        )


orchestrator_service = EDCommandOrchestratorService()
