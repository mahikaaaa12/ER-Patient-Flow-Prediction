import time
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List

from .supervised_service import supervised_service
from .unsupervised_service import unsupervised_service
from .deep_learning_service import deep_learning_service
from ..schemas.hospital_state import HospitalState
from ..schemas.overview import (
    DashboardOverviewResponse,
    AssistantQueryRequest,
    AssistantQueryResponse,
    AssistantInsightItem,
)

logger = logging.getLogger("erflow.overview_service")


class OverviewService:
    """Combines outputs from all three ML pillars for the Overview dashboard and AI Assistant using concurrent non-redundant execution."""

    def get_overview(self, state: HospitalState) -> DashboardOverviewResponse:
        req_id = f"req-{uuid.uuid4().hex[:8]}"
        t_start = time.perf_counter()

        engine_status: Dict[str, str] = {
            "forecast": "success",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_pattern": "success",
            "surge_detection": "success",
        }
        engine_timings: Dict[str, float] = {}

        # 1. Primary Waiting Time Prediction (serves as input for downstream flow/surge features)
        t0 = time.perf_counter()
        try:
            waiting = supervised_service.predict_waiting_time(state)
            engine_timings["waiting_time"] = (time.perf_counter() - t0) * 1000.0
        except Exception as e:
            logger.error(f"[{req_id}] Waiting time engine failed: {e}", exc_info=True)
            engine_status["waiting_time"] = "failed"
            engine_timings["waiting_time"] = (time.perf_counter() - t0) * 1000.0
            from ..schemas.supervised import WaitingTimeResponse
            waiting = WaitingTimeResponse(
                waiting_time_minutes=42.0,
                predicted_1h=45.0,
                predicted_peak=55.0,
                trend="Stable",
                model_name="XGBoost Regressor (Fallback)",
            )

        # Build state with precomputed waiting_time_minutes to eliminate redundant model calls in flow & surge
        state_with_wt = state.model_copy(update={"waiting_time_minutes": waiting.waiting_time_minutes})

        # 2. Concurrently execute remaining independent prediction engines
        def run_forecast():
            tf0 = time.perf_counter()
            try:
                res = deep_learning_service.forecast_arrivals(state)
                return res, (time.perf_counter() - tf0) * 1000.0, None
            except Exception as err:
                return None, (time.perf_counter() - tf0) * 1000.0, err

        def run_crowding():
            tc0 = time.perf_counter()
            try:
                res = supervised_service.predict_crowding_risk(state)
                return res, (time.perf_counter() - tc0) * 1000.0, None
            except Exception as err:
                return None, (time.perf_counter() - tc0) * 1000.0, err

        def run_flow():
            tfl0 = time.perf_counter()
            try:
                res = unsupervised_service.predict_flow_pattern(state_with_wt)
                return res, (time.perf_counter() - tfl0) * 1000.0, None
            except Exception as err:
                return None, (time.perf_counter() - tfl0) * 1000.0, err

        def run_surge():
            tsg0 = time.perf_counter()
            try:
                res = unsupervised_service.detect_surge(state_with_wt)
                return res, (time.perf_counter() - tsg0) * 1000.0, None
            except Exception as err:
                return None, (time.perf_counter() - tsg0) * 1000.0, err

        with ThreadPoolExecutor(max_workers=4, thread_name_prefix="erflow_inference") as executor:
            fut_fc = executor.submit(run_forecast)
            fut_cr = executor.submit(run_crowding)
            fut_fl = executor.submit(run_flow)
            fut_sg = executor.submit(run_surge)

            forecast, t_fc, err_fc = fut_fc.result()
            crowding, t_cr, err_cr = fut_cr.result()
            flow, t_fl, err_fl = fut_fl.result()
            surge, t_sg, err_sg = fut_sg.result()

        engine_timings["forecast"] = t_fc
        engine_timings["crowding_risk"] = t_cr
        engine_timings["flow_pattern"] = t_fl
        engine_timings["surge_detection"] = t_sg

        # Process results / handle engine-level fallbacks
        if err_fc or forecast is None:
            logger.error(f"[{req_id}] Forecast engine failed: {err_fc}", exc_info=True)
            engine_status["forecast"] = "failed"
            from ..schemas.deep_learning import ArrivalForecastResponse, ForecastHorizon
            forecast = ArrivalForecastResponse(
                horizons={"1h": 12, "3h": 36, "6h": 72, "24h": 280},
                forecast_cards=[ForecastHorizon(id="3h", label="Next 3 Hours", value=36, unit="patients")],
                predicted_peak_time="7:00 PM",
                predicted_peak_rate=28,
                trend="Stable",
                series=[],
                model_name="LSTM Neural Network (Fallback)",
            )

        if err_cr or crowding is None:
            logger.error(f"[{req_id}] Crowding engine failed: {err_cr}", exc_info=True)
            engine_status["crowding_risk"] = "failed"
            from ..schemas.supervised import CrowdingRiskResponse
            crowding = CrowdingRiskResponse(
                crowding_level="MODERATE",
                crowding_score=50,
                probabilities={"Moderate": 0.6, "Low": 0.4},
                model_name="XGBoost Classifier (Fallback)",
            )

        if err_fl or flow is None:
            logger.error(f"[{req_id}] Flow pattern engine failed: {err_fl}", exc_info=True)
            engine_status["flow_pattern"] = "failed"
            from ..schemas.unsupervised import FlowPatternResponse
            flow = FlowPatternResponse(
                pattern_name="Medium Demand",
                confidence=85.0,
                cluster_id=1,
                description="Standard operational baseline.",
                current_point={"x": 50.0, "y": 50.0},
                model_name="K-Means Clustering (Fallback)",
            )

        if err_sg or surge is None:
            logger.error(f"[{req_id}] Surge engine failed: {err_sg}", exc_info=True)
            engine_status["surge_detection"] = "failed"
            from ..schemas.unsupervised import SurgeDetectionResponse
            surge = SurgeDetectionResponse(
                is_surge=False,
                status="NORMAL OPERATIONAL LOAD",
                severity="Low",
                current_arrival_rate=float(state.arrival_rate),
                normal_arrival_rate="14–22",
                deviation_percent="0%",
                detected_at="6:00 PM",
                description="Arrival volume within expected operating limits.",
                model_name="Surge Anomaly Detector (Fallback)",
            )

        t_tot = (time.perf_counter() - t_start) * 1000.0
        status_str = "SUCCESS" if all(v == "success" for v in engine_status.values()) else "DEGRADED"

        logger.info(
            f"[Inference {req_id}] Forecast: {t_fc:.1f}ms | WaitingTime: {engine_timings['waiting_time']:.1f}ms | "
            f"Crowding: {t_cr:.1f}ms | FlowPattern: {t_fl:.1f}ms | Surge: {t_sg:.1f}ms | Total: {t_tot:.1f}ms | Status: {status_str}"
        )

        summary_text = (
            f"Patient demand is forecasted at {forecast.horizons.get('3h', 36)} arrivals over the next 3 hours. "
            f"Expected waiting time is currently {waiting.waiting_time_minutes:.0f} minutes with a {crowding.crowding_level} "
            f"crowding risk (score: {crowding.crowding_score}/100). Current flow pattern reflects {flow.pattern_name} "
            f"({flow.confidence:.0f}% confidence) with {surge.status.lower()}."
        )

        return DashboardOverviewResponse(
            forecast=forecast,
            waiting_time=waiting,
            crowding_risk=crowding,
            flow_pattern=flow,
            surge_detection=surge,
            ai_summary_text=summary_text,
            request_id=req_id,
            execution_time_ms=round(t_tot, 2),
            engine_status=engine_status,
        )

    def answer_assistant_query(self, query_req: AssistantQueryRequest) -> AssistantQueryResponse:
        state_dict = query_req.hospital_state or {}
        state = HospitalState(**state_dict) if state_dict else HospitalState()

        overview = self.get_overview(state)
        q = query_req.question.lower()

        # Dynamic query routing
        if "busiest" in q or "peak" in q or "when" in q:
            text = (
                f"Patient arrivals are expected to peak around {overview.forecast.predicted_peak_time} "
                f"with an arrival velocity of {overview.forecast.predicted_peak_rate} patients/hour. "
                f"The next 3-hour projection indicates {overview.forecast.horizons['3h']} cumulative arrivals, "
                f"bringing crowding risk to {overview.crowding_risk.crowding_level}."
            )
            insights = [
                AssistantInsightItem(label="Expected Arrivals", value=str(overview.forecast.horizons["3h"]), icon="Users", tone="blue"),
                AssistantInsightItem(label="Peak Time", value=overview.forecast.predicted_peak_time, icon="Clock", tone="teal"),
                AssistantInsightItem(label="Crowding Risk", value=overview.crowding_risk.crowding_level, icon="AlertTriangle", tone="red" if overview.crowding_risk.crowding_level in ["HIGH", "CRITICAL"] else "amber"),
                AssistantInsightItem(label="Expected Wait", value=f"{overview.waiting_time.waiting_time_minutes:.0f} min", icon="Timer", tone="amber"),
            ]
        elif "wait" in q or "time" in q:
            text = (
                f"Average waiting time is estimated at {overview.waiting_time.waiting_time_minutes:.0f} minutes by the XGBoost Regressor. "
                f"Wait time is {overview.waiting_time.trend.lower()} and projected to reach {overview.waiting_time.predicted_1h:.0f} minutes "
                f"over the next hour with bed occupancy at {state.occupancy_percent:.0f}%."
            )
            insights = [
                AssistantInsightItem(label="Expected Wait", value=f"{overview.waiting_time.waiting_time_minutes:.0f} min", icon="Timer", tone="amber"),
                AssistantInsightItem(label="Wait Trend", value=overview.waiting_time.trend, icon="TrendingUp", tone="red" if overview.waiting_time.trend == "Increasing" else "teal"),
                AssistantInsightItem(label="Projected 1h", value=f"{overview.waiting_time.predicted_1h:.0f} min", icon="Clock", tone="blue"),
                AssistantInsightItem(label="Beds Occupied", value=f"{state.occupancy_percent:.0f}%", icon="Activity", tone="teal"),
            ]
        elif "surge" in q or "spike" in q:
            text = (
                f"{'Abnormal patient surge detected!' if overview.surge_detection.is_surge else 'No anomalous surge detected.'} "
                f"Current arrival rate is {overview.surge_detection.current_arrival_rate:.0f} patients/hour versus the expected baseline "
                f"of {overview.surge_detection.normal_arrival_rate} ({overview.surge_detection.deviation_percent})."
            )
            insights = [
                AssistantInsightItem(label="Surge Status", value=overview.surge_detection.severity, icon="AlertTriangle", tone="red" if overview.surge_detection.is_surge else "green"),
                AssistantInsightItem(label="Arrival Rate", value=f"{overview.surge_detection.current_arrival_rate:.0f}/hr", icon="TrendingUp", tone="amber"),
                AssistantInsightItem(label="Deviation", value=overview.surge_detection.deviation_percent, icon="Activity", tone="blue"),
                AssistantInsightItem(label="Baseline", value=f"{overview.surge_detection.normal_arrival_rate}/hr", icon="Clock", tone="teal"),
            ]
        elif "flow" in q or "pattern" in q:
            text = (
                f"The ER is exhibiting a '{overview.flow_pattern.pattern_name}' pattern with {overview.flow_pattern.confidence:.0f}% "
                f"confidence. {overview.flow_pattern.description}"
            )
            insights = [
                AssistantInsightItem(label="Flow Pattern", value=overview.flow_pattern.pattern_name, icon="Activity", tone="blue"),
                AssistantInsightItem(label="Confidence", value=f"{overview.flow_pattern.confidence:.0f}%", icon="Cpu", tone="teal"),
                AssistantInsightItem(label="Peak Time", value=overview.forecast.predicted_peak_time, icon="Clock", tone="amber"),
                AssistantInsightItem(label="Crowding Risk", value=overview.crowding_risk.crowding_level, icon="AlertTriangle", tone="red" if overview.crowding_risk.crowding_level in ["HIGH", "CRITICAL"] else "amber"),
            ]
        elif "crowding" in q or "cause" in q or "risk" in q:
            text = (
                f"Crowding risk is {overview.crowding_risk.crowding_level} with an index of {overview.crowding_risk.crowding_score}/100. "
                f"Key drivers are current occupancy ({state.occupancy_percent:.0f}%), {state.patients_waiting:.0f} waiting patients, "
                f"and forecasted arrivals of {overview.forecast.horizons['3h']} patients over the next 3 hours."
            )
            insights = [
                AssistantInsightItem(label="Crowding Score", value=f"{overview.crowding_risk.crowding_score}/100", icon="AlertTriangle", tone="red"),
                AssistantInsightItem(label="Bed Occupancy", value=f"{state.occupancy_percent:.0f}%", icon="Activity", tone="amber"),
                AssistantInsightItem(label="Patients Waiting", value=str(int(state.patients_waiting)), icon="Users", tone="blue"),
                AssistantInsightItem(label="Available Beds", value=str(int(state.available_beds)), icon="Activity", tone="teal"),
            ]
        else:
            text = (
                f"Operational Status: The ER is experiencing {overview.flow_pattern.pattern_name.lower()} conditions. "
                f"Predicted arrivals over next 3h: {overview.forecast.horizons['3h']}. Average wait time: {overview.waiting_time.waiting_time_minutes:.0f} min. "
                f"Overall crowding level: {overview.crowding_risk.crowding_level}."
            )
            insights = [
                AssistantInsightItem(label="Wait Time", value=f"{overview.waiting_time.waiting_time_minutes:.0f} min", icon="Timer", tone="amber"),
                AssistantInsightItem(label="Crowding", value=overview.crowding_risk.crowding_level, icon="AlertTriangle", tone="red" if overview.crowding_risk.crowding_level in ["HIGH", "CRITICAL"] else "teal"),
                AssistantInsightItem(label="3h Forecast", value=str(overview.forecast.horizons["3h"]), icon="Users", tone="blue"),
                AssistantInsightItem(label="Pattern", value=overview.flow_pattern.pattern_name, icon="Activity", tone="teal"),
            ]

        return AssistantQueryResponse(text=text, insights=insights)


overview_service = OverviewService()
