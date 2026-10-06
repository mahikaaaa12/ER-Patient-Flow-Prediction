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

        # Lazy import of orchestrator service to prevent circular dependency
        from .orchestrator_service import orchestrator_service
        try:
            orch = orchestrator_service.analyze_operations(state)
        except Exception:
            orch = None

        plevel = orch.pressure_level if orch else "MODERATE"
        pscore = orch.overall_pressure_score if orch else 50.0
        w_assess = orch.workload_assessment if orch else None
        doc_ratio = w_assess.doctor_load_ratio if w_assess else round(state.patients_waiting / max(1.0, state.available_doctors), 1)
        nurse_ratio = w_assess.nurse_load_ratio if w_assess else round((state.patients_waiting + state.occupancy_percent * 0.35) / max(1.0, state.available_nurses), 1)
        top_issue = orch.prioritized_issues[0] if orch and orch.prioritized_issues else None
        top_rec = orch.recommended_actions[0] if orch and orch.recommended_actions else None

        # 1. Biggest Issue / What Needs Attention
        if any(k in q for k in ["biggest issue", "needs attention", "attention right now", "biggest concern", "primary issue"]):
            if top_issue and top_rec:
                expl = top_rec.explanation_detail
                text = (
                    f"⚡ **ED Operations Command Center Assessment**:\n\n"
                    f"**CURRENT DATA**:\n"
                    f"• **Overall Pressure**: {plevel} ({pscore:.1f}/100 index)\n"
                    f"• **Top Priority Issue**: [{top_issue.severity}] {top_issue.category} - {top_issue.title}\n"
                    f"• **Current Telemetry**: Occupancy {state.occupancy_percent:.0f}%, {state.patients_waiting:.0f} waiting, {state.available_beds:.0f} beds available\n\n"
                    f"**FORECAST**:\n"
                    f"• **3h Arrival Projection**: {overview.forecast.horizons.get('3h', 36)} patients (Peak: {overview.forecast.predicted_peak_rate} pts/hr at {overview.forecast.predicted_peak_time})\n"
                    f"• **Wait Time Projection**: {overview.waiting_time.waiting_time_minutes:.0f} minutes average\n\n"
                    f"**RECOMMENDED OPERATIONAL ACTION**:\n"
                    f"• **Action**: {top_rec.title}\n"
                    f"• **Recommended**: {top_rec.recommended_action}\n"
                    f"• **Urgency**: {top_rec.urgency}\n\n"
                    f"**SIMULATION**:\n"
                    f"• Test this intervention (e.g., adding 1 nurse or physician) in the **⚡ Scenario Simulator** page.\n\n"
                    f"**GENERAL GUIDANCE**:\n"
                    f"• {expl.staff_review_guidance if expl else 'Review staff shift allocations.'}"
                )
            else:
                text = f"Operational pressure is currently {plevel} ({pscore:.1f}/100 index). All operational metrics remain within standard baseline."

            insights = [
                AssistantInsightItem(label="Top Concern", value=top_issue.category if top_issue else "OPERATIONS", icon="AlertTriangle", tone="red" if plevel in ["HIGH", "CRITICAL"] else "amber"),
                AssistantInsightItem(label="Pressure Level", value=plevel, icon="Activity", tone="red" if plevel in ["HIGH", "CRITICAL"] else "teal"),
                AssistantInsightItem(label="Queue Waiting", value=f"{state.patients_waiting:.0f} pts", icon="Users", tone="blue"),
                AssistantInsightItem(label="Action Urgency", value=top_rec.urgency if top_rec else "ROUTINE", icon="Clock", tone="amber"),
            ]

        # 2. Why is Workload High / Under Pressure
        elif any(k in q for k in ["why is workload", "under pressure", "why is workload high", "workload high", "why pressure"]):
            text = (
                f"⚡ **Workload & Pressure Rationale**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Pressure Level**: {plevel} ({pscore:.1f}/100 index)\n"
                f"• **Doctor Load Ratio**: {doc_ratio} waiting patients/MD\n"
                f"• **Nurse Load Ratio**: {nurse_ratio} active patients/RN\n"
                f"• **Bed Occupancy**: {state.occupancy_percent:.0f}% with {state.patients_waiting:.0f} patients waiting\n\n"
                f"**FORECAST**:\n"
                f"• **Arrival Velocity**: {state.arrival_rate:.0f} pts/hr (Projected 3h arrivals: {overview.forecast.horizons.get('3h', 36)})\n"
                f"• **Expected Wait Time**: {overview.waiting_time.waiting_time_minutes:.0f} minutes (trend: {overview.waiting_time.trend})\n\n"
                f"**SIMULATION**:\n"
                f"• Simulate adding staff or expanding bed capacity in the **⚡ Scenario Simulator** to evaluate workload reduction.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• Monitor provider shift overlaps and expedite inpatient transfer velocity to reduce bed occupancy."
            )
            insights = [
                AssistantInsightItem(label="Pressure Index", value=f"{pscore:.0f}/100", icon="Activity", tone="red" if pscore > 60 else "amber"),
                AssistantInsightItem(label="Doctor Ratio", value=f"{doc_ratio} pts/MD", icon="User", tone="blue"),
                AssistantInsightItem(label="Nurse Ratio", value=f"{nurse_ratio} pts/RN", icon="Users", tone="teal"),
                AssistantInsightItem(label="Occupancy", value=f"{state.occupancy_percent:.0f}%", icon="Percent", tone="amber"),
            ]

        # 3. What Should Staff Monitor Next / Upcoming 2 Hours
        elif any(k in q for k in ["monitor next", "next two hours", "monitor over", "should staff monitor"]):
            upcoming_level = w_assess.upcoming_3h_workload_level if w_assess else "MODERATE"
            text = (
                f"⚡ **Upcoming Workload & Monitoring Trajectory**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Current Status**: {plevel} Pressure | Arrival Rate: {state.arrival_rate:.0f} pts/hr\n"
                f"• **Active Triage Queue**: {state.patients_waiting:.0f} patients\n\n"
                f"**FORECAST**:\n"
                f"• **Upcoming Workload Trajectory**: {upcoming_level} Risk\n"
                f"• **Projected Peak**: {overview.forecast.predicted_peak_rate} pts/hr expected around {overview.forecast.predicted_peak_time}\n"
                f"• **3h Cumulative Demand**: {overview.forecast.horizons.get('3h', 36)} expected arrivals\n"
                f"• **Wait Time Trajectory**: {overview.waiting_time.waiting_time_minutes:.0f} min (projected 1h: {overview.waiting_time.predicted_1h:.0f} min)\n\n"
                f"**SIMULATION**:\n"
                f"• Test pre-staging shift overlaps in the **⚡ Scenario Simulator** ahead of the peak arrival window.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• Staff should pre-stock triage supply carts, clear fast-track treatment bays, and monitor incoming EMS ambulance notifications."
            )
            insights = [
                AssistantInsightItem(label="Upcoming Risk", value=upcoming_level, icon="TrendingUp", tone="red" if upcoming_level in ["HIGH", "CRITICAL"] else "amber"),
                AssistantInsightItem(label="Peak Rate", value=f"{overview.forecast.predicted_peak_rate}/hr", icon="Clock", tone="blue"),
                AssistantInsightItem(label="Peak Window", value=overview.forecast.predicted_peak_time, icon="Clock", tone="teal"),
                AssistantInsightItem(label="3h Forecast", value=str(overview.forecast.horizons.get('3h', 36)), icon="Users", tone="amber"),
            ]

        # 4. Why Triage Capacity Flagged
        elif any(k in q for k in ["triage capacity", "triage flagged", "why is triage"]):
            triage_rec = next((r for r in (orch.recommended_actions if orch else []) if r.category == "TRIAGE CAPACITY"), top_rec)
            expl = triage_rec.explanation_detail if triage_rec else None
            text = (
                f"⚡ **Triage Capacity Rationale & Explanation**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Triage Queue**: {state.patients_waiting:.0f} patients waiting\n"
                f"• **Current Arrival Velocity**: {state.arrival_rate:.0f} pts/hr\n\n"
                f"**FORECAST**:\n"
                f"• **Predicted Average Wait**: {overview.waiting_time.waiting_time_minutes:.0f} minutes (XGBoost Regressor)\n"
                f"• **Wait Time Trend**: {overview.waiting_time.trend}\n\n"
                f"**XAI EXPLANATION**:\n"
                f"• **Why Flagged**: {expl.detection_rationale if expl else 'Queue size exceeds single-triage intake throughput.'}\n"
                f"• **Strongest Influencer**: {expl.strongest_influencer if expl else 'Patients waiting count.'}\n\n"
                f"**RECOMMENDED OPERATIONAL ACTION**:\n"
                f"• **Action**: {triage_rec.title if triage_rec else 'Deploy Auxiliary Triage Screening'}\n"
                f"• **Details**: {triage_rec.recommended_action if triage_rec else 'Assign a second triage nurse to open fast-track intake.'}\n\n"
                f"**SIMULATION**:\n"
                f"• Simulate adding 1 triage nurse in the **⚡ Scenario Simulator** to evaluate queue reduction.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• {expl.staff_review_guidance if expl else 'Review triage nurse screening speed and fast-track availability.'}"
            )
            insights = [
                AssistantInsightItem(label="Triage Queue", value=f"{state.patients_waiting:.0f} pts", icon="Users", tone="red"),
                AssistantInsightItem(label="Predicted Wait", value=f"{overview.waiting_time.waiting_time_minutes:.0f} min", icon="Timer", tone="amber"),
                AssistantInsightItem(label="Wait Trend", value=overview.waiting_time.trend, icon="TrendingUp", tone="blue"),
                AssistantInsightItem(label="Rec Action", value="Auxiliary Triage", icon="Activity", tone="teal"),
            ]

        # 5. Simulate Adding a Nurse
        elif any(k in q for k in ["simulate adding", "add one nurse", "add a nurse", "simulate nurse"]):
            text = (
                f"🧪 **Scenario Simulation Guidance - Staffing Intervention**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Active Nurses**: {state.available_nurses:.0f} RNs\n"
                f"• **Current Nurse Load Ratio**: {nurse_ratio} active patients/RN\n"
                f"• **Current Average Wait Time**: {overview.waiting_time.waiting_time_minutes:.0f} minutes\n\n"
                f"**SIMULATION (WHAT-IF ANALYSIS)**:\n"
                f"• **Intervention**: Adding +1 Nurse reduces the Nurse Load Ratio to ~{round((state.patients_waiting + state.occupancy_percent * 0.35) / max(1.0, state.available_nurses + 1), 1)} pts/RN.\n"
                f"• **Operational Impact**: Improves intake processing speed and reduces expected wait time by ~15-25%.\n"
                f"• **How to Execute**: Open the **⚡ Scenario Simulator** page or click **[Simulate]** on the Command Center triage recommendation card to compare **BASELINE** vs **SIMULATED INTERVENTION** side-by-side.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• All simulated metrics are clearly labeled as `SIMULATION / WHAT-IF` for decision support and do not alter live telemetry."
            )
            insights = [
                AssistantInsightItem(label="Current RNs", value=f"{state.available_nurses:.0f} active", icon="Users", tone="blue"),
                AssistantInsightItem(label="Nurse Load", value=f"{nurse_ratio} pts/RN", icon="Activity", tone="amber"),
                AssistantInsightItem(label="Simulated RNs", value=f"{state.available_nurses + 1:.0f} RNs", icon="Sparkles", tone="teal"),
                AssistantInsightItem(label="Sim Tool", value="Scenario Simulator", icon="Cpu", tone="teal"),
            ]

        # 6. Highest Pressure Resource / Area
        elif any(k in q for k in ["highest pressure", "most pressure", "which resource", "highest resource"]):
            highest_area = top_issue.category if top_issue else ("BED CAPACITY" if state.occupancy_percent > 80 else "TRIAGE QUEUE")
            text = (
                f"⚡ **Resource Pressure Breakdown**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Highest Pressure Area**: **{highest_area}**\n"
                f"• **Bed Occupancy**: {state.occupancy_percent:.0f}% ({state.available_beds:.0f} beds available)\n"
                f"• **Waiting Queue**: {state.patients_waiting:.0f} patients waiting\n"
                f"• **Doctor Load**: {doc_ratio} pts/MD | **Nurse Load**: {nurse_ratio} pts/RN\n\n"
                f"**FORECAST**:\n"
                f"• **3h Demand**: {overview.forecast.horizons.get('3h', 36)} expected arrivals\n"
                f"• **Crowding Score**: {overview.crowding_risk.crowding_score}/100 ({overview.crowding_risk.crowding_level})\n\n"
                f"**RECOMMENDED ACTION**:\n"
                f"• **Mitigation**: {top_rec.title if top_rec else 'Reallocate staff to bottleneck area.'}\n\n"
                f"**SIMULATION**:\n"
                f"• Simulate reallocating resources in the **⚡ Scenario Simulator** page.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• Prioritize supervisor intervention on {highest_area} to relieve department throughput bottlenecks."
            )
            insights = [
                AssistantInsightItem(label="Highest Pressure", value=highest_area, icon="ShieldAlert", tone="red"),
                AssistantInsightItem(label="Bed Occupancy", value=f"{state.occupancy_percent:.0f}%", icon="Percent", tone="amber"),
                AssistantInsightItem(label="Waiting Queue", value=f"{state.patients_waiting:.0f} pts", icon="Users", tone="blue"),
                AssistantInsightItem(label="Crowding Risk", value=overview.crowding_risk.crowding_level, icon="AlertTriangle", tone="red" if overview.crowding_risk.crowding_level in ["HIGH", "CRITICAL"] else "amber"),
            ]

        # 7. Crowding Risk Factors / Causes
        elif any(k in q for k in ["crowding risk", "causes of crowding", "contributing to crowding", "why crowding"]):
            crowd_rec = next((r for r in (orch.recommended_actions if orch else []) if r.category == "BED CAPACITY"), top_rec)
            expl = crowd_rec.explanation_detail if crowd_rec else None
            text = (
                f"⚡ **Crowding Risk & Contributing Factors (XAI Analysis)**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• **Crowding Level**: {overview.crowding_risk.crowding_level} (Score: {overview.crowding_risk.crowding_score}/100)\n"
                f"• **Bed Occupancy**: {state.occupancy_percent:.0f}%\n"
                f"• **Patients Waiting**: {state.patients_waiting:.0f} patients\n\n"
                f"**FORECAST**:\n"
                f"• **Upcoming 3h Influx**: {overview.forecast.horizons.get('3h', 36)} expected arrivals\n\n"
                f"**XAI TREE SHAP CONTRIBUTING FACTORS**:\n"
                f"• **Primary Rationale**: {expl.detection_rationale if expl else 'High bed occupancy correlated with rising arrival velocity.'}\n"
                f"• **Strongest Influencer**: {expl.strongest_influencer if expl else 'Bed Occupancy Percent.'}\n\n"
                f"**SIMULATION**:\n"
                f"• Test expanding bed availability or adding discharge lounge bays in the **⚡ Scenario Simulator**.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• {expl.staff_review_guidance if expl else 'Expedite inpatient bed turnover and discharge processing.'}"
            )
            insights = [
                AssistantInsightItem(label="Crowding Score", value=f"{overview.crowding_risk.crowding_score}/100", icon="AlertTriangle", tone="red"),
                AssistantInsightItem(label="Bed Occupancy", value=f"{state.occupancy_percent:.0f}%", icon="Activity", tone="amber"),
                AssistantInsightItem(label="Waiting Queue", value=str(int(state.patients_waiting)), icon="Users", tone="blue"),
                AssistantInsightItem(label="Available Beds", value=str(int(state.available_beds)), icon="Activity", tone="teal"),
            ]

        # 8. Standard Fallback Queries (busiest, wait times, surge, flow, general)
        elif "busiest" in q or "peak" in q or "when" in q:
            text = (
                f"Patient arrivals are expected to peak around {overview.forecast.predicted_peak_time} "
                f"with an arrival velocity of {overview.forecast.predicted_peak_rate} patients/hour. "
                f"The next 3-hour projection indicates {overview.forecast.horizons.get('3h', 36)} cumulative arrivals, "
                f"bringing crowding risk to {overview.crowding_risk.crowding_level}."
            )
            insights = [
                AssistantInsightItem(label="Expected Arrivals", value=str(overview.forecast.horizons.get('3h', 36)), icon="Users", tone="blue"),
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
        else:
            text = (
                f"⚡ **Operational ER Command Status**:\n\n"
                f"**CURRENT DATA**:\n"
                f"• Pressure Level: {plevel} ({pscore:.0f}/100 index)\n"
                f"• Bed Occupancy: {state.occupancy_percent:.0f}%\n"
                f"• Patients Waiting: {state.patients_waiting:.0f} patients\n\n"
                f"**FORECAST**:\n"
                f"• Predicted 3h Arrivals: {overview.forecast.horizons.get('3h', 36)}\n"
                f"• Average Wait Time: {overview.waiting_time.waiting_time_minutes:.0f} min\n"
                f"• Crowding Risk: {overview.crowding_risk.crowding_level}\n\n"
                f"**SIMULATION**:\n"
                f"• Run scenario simulations on the **⚡ Scenario Simulator** page.\n\n"
                f"**GENERAL GUIDANCE**:\n"
                f"• Monitor triage throughput and provider shift availability."
            )
            insights = [
                AssistantInsightItem(label="Wait Time", value=f"{overview.waiting_time.waiting_time_minutes:.0f} min", icon="Timer", tone="amber"),
                AssistantInsightItem(label="Crowding", value=overview.crowding_risk.crowding_level, icon="AlertTriangle", tone="red" if overview.crowding_risk.crowding_level in ["HIGH", "CRITICAL"] else "teal"),
                AssistantInsightItem(label="3h Forecast", value=str(overview.forecast.horizons.get('3h', 36)), icon="Users", tone="blue"),
                AssistantInsightItem(label="Pattern", value=overview.flow_pattern.pattern_name, icon="Activity", tone="teal"),
            ]

        return AssistantQueryResponse(text=text, insights=insights)


overview_service = OverviewService()
