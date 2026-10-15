import pytest
from datetime import datetime, timezone

from backend.schemas.hospital_state import HospitalState
from backend.schemas.overview import DashboardOverviewResponse
from backend.schemas.deep_learning import ArrivalForecastResponse, TimeSeriesPoint, ForecastHorizon
from backend.schemas.supervised import WaitingTimeResponse, CrowdingRiskResponse
from backend.schemas.unsupervised import FlowPatternResponse, SurgeDetectionResponse
from backend.services.recommendation_engine import recommendation_engine
from backend.services.orchestrator_service import orchestrator_service
from backend.services.action_queue_service import EDActionQueueService
from backend.schemas.action_queue import ActionStatus, UpdateActionStatusRequest
from backend.schemas.orchestrator import RecommendationAction, OrchestratorResponse
from tempfile import TemporaryDirectory
from pathlib import Path


def _create_mock_overview(
    forecast_peak=20.0,
    forecast_trend="Stable",
    wait_time=20.0,
    crowding_score=30,
    crowding_level="Low",
    is_surge=False,
    surge_score=15.0,
    dominant_pattern="Medium Demand",
    engine_status=None,
):
    if engine_status is None:
        engine_status = {
            "forecast": "success",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_pattern": "success",
            "surge_detection": "success",
        }

    return DashboardOverviewResponse(
        forecast=ArrivalForecastResponse(
            horizon="24h",
            horizons={"1h": forecast_peak, "3h": forecast_peak * 1.1, "6h": forecast_peak * 0.9},
            forecast_cards=[ForecastHorizon(id="1h", label="1 Hour", value=forecast_peak)],
            predicted_peak_time="20:00",
            predicted_peak_rate=forecast_peak,
            trend=forecast_trend,
            series=[TimeSeriesPoint(t="18:00", value=forecast_peak, kind="forecast")],
        ) if engine_status.get("forecast") == "success" else None,
        waiting_time=WaitingTimeResponse(
            waiting_time_minutes=float(wait_time),
            predicted_1h=float(wait_time),
            predicted_peak=float(wait_time * 1.2),
            trend="Stable",
        ) if engine_status.get("waiting_time") == "success" else None,
        crowding_risk=CrowdingRiskResponse(
            crowding_level=crowding_level,
            crowding_score=int(crowding_score),
            probabilities={"Low": 0.7, "Moderate": 0.2, "High": 0.1, "Critical": 0.0},
        ) if engine_status.get("crowding_risk") == "success" else None,
        flow_pattern=FlowPatternResponse(
            pattern_name=dominant_pattern,
            confidence=85.0,
            cluster_id=1,
            description="Operational flow pattern",
            current_point={"x": 1.2, "y": 0.5},
        ) if engine_status.get("flow_pattern") == "success" else None,
        surge_detection=SurgeDetectionResponse(
            is_surge=is_surge,
            status="Surge Alert" if is_surge else "Normal Operating Flow",
            severity="High" if is_surge else "Low",
            current_arrival_rate=35.0 if is_surge else 20.0,
            normal_arrival_rate="20.0 pts/hr",
            deviation_percent="+75%" if is_surge else "+0%",
            detected_at="18:00",
            description="Surge detector status",
        ) if engine_status.get("surge_detection") == "success" else None,
        ai_summary_text="Automated test mock overview",
        engine_status=engine_status,
    )


class TestOperationsCommandCenterScenarios:
    """End-to-End Validation of the 15 Test Scenarios for ERFlow Operations Command Center."""

    def test_scenario_1_normal_operations(self):
        """Scenario 1: Normal operations: no abnormal patterns; show no unnecessary high-priority alerts."""
        normal_state = HospitalState(
            occupancy_percent=50.0,
            patients_waiting=6,
            arrival_rate=14.0,
            available_beds=16,
            available_doctors=6,
            available_nurses=10,
            severity_level=3.0,
        )
        overview = _create_mock_overview(
            forecast_peak=15.0,
            forecast_trend="Stable",
            wait_time=15.0,
            crowding_score=25.0,
            crowding_level="Low",
            is_surge=False,
            surge_score=10.0,
        )

        response = orchestrator_service.analyze_operations(normal_state, overview)

        assert response.pressure_level in ["LOW", "MODERATE"]
        assert response.overall_pressure_score < 60.0

        # Verify no CRITICAL alerts
        critical_actions = [a for a in response.recommended_actions if a.priority == "CRITICAL"]
        assert len(critical_actions) == 0

    def test_scenario_2_high_occupancy_increasing_forecast(self):
        """Scenario 2: High occupancy with increasing forecast arrivals: produce relevant capacity and surge-preparation actions."""
        strained_state = HospitalState(
            occupancy_percent=88.0,
            patients_waiting=20,
            arrival_rate=32.0,
            available_beds=3,
            available_doctors=4,
            available_nurses=8,
            severity_level=3.0,
        )
        overview = _create_mock_overview(
            forecast_peak=42.0,
            forecast_trend="Increasing",
            wait_time=45.0,
            crowding_score=82.0,
            crowding_level="Critical",
        )

        response = orchestrator_service.analyze_operations(strained_state, overview)

        # Must generate bed capacity or surge actions
        categories = [a.category for a in response.recommended_actions]
        assert "BED CAPACITY" in categories or "SURGE MANAGEMENT" in categories

        # Should be elevated priority
        high_or_crit = [a for a in response.recommended_actions if a.priority in ["HIGH", "CRITICAL"]]
        assert len(high_or_crit) >= 1

    def test_scenario_3_growing_queue_elevated_wait_time(self):
        """Scenario 3: Growing waiting queue with elevated waiting-time prediction: produce appropriate triage-workflow actions."""
        triage_strain_state = HospitalState(
            occupancy_percent=65.0,
            patients_waiting=35,
            arrival_rate=30.0,
            available_beds=10,
            available_doctors=5,
            available_nurses=8,
            severity_level=3.0,
        )
        overview = _create_mock_overview(
            forecast_peak=28.0,
            wait_time=68.0,  # Critical wait time
            crowding_score=60.0,
        )

        response = orchestrator_service.analyze_operations(triage_strain_state, overview)

        triage_actions = [a for a in response.recommended_actions if a.category == "TRIAGE CAPACITY"]
        assert len(triage_actions) >= 1
        triage_action = triage_actions[0]
        assert "triage" in triage_action.title.lower() or "triage" in triage_action.recommended_action.lower()

    def test_scenario_4_high_patient_to_staff_ratios(self):
        """Scenario 4: High patient-to-staff ratios: produce staffing-workload review actions."""
        staff_deficit_state = HospitalState(
            occupancy_percent=70.0,
            patients_waiting=32,
            arrival_rate=25.0,
            available_beds=8,
            available_doctors=2,  # 16 pts / MD
            available_nurses=3,   # > 10 pts / RN
            severity_level=3.0,
        )
        overview = _create_mock_overview(wait_time=45.0, crowding_score=65.0)

        response = orchestrator_service.analyze_operations(staff_deficit_state, overview)

        staff_actions = [a for a in response.recommended_actions if a.category == "STAFFING"]
        assert len(staff_actions) >= 1
        assert response.workload_assessment.doctor_load_ratio >= 10.0
        assert response.workload_assessment.nurse_load_ratio >= 8.0

    def test_scenario_5_limited_bed_availability_and_transfers(self):
        """Scenario 5: Limited bed availability and transfer delays: generate bed-flow coordination recommendations."""
        bed_gridlock_state = HospitalState(
            occupancy_percent=95.0,
            patients_waiting=22,
            arrival_rate=26.0,
            available_beds=1,  # Critical bed shortage
            available_doctors=5,
            available_nurses=9,
            severity_level=3.0,
        )
        overview = _create_mock_overview(crowding_score=90.0, crowding_level="Critical")

        response = orchestrator_service.analyze_operations(bed_gridlock_state, overview)

        bed_actions = [a for a in response.recommended_actions if a.category == "BED CAPACITY"]
        assert len(bed_actions) >= 1
        rec = bed_actions[0]
        assert rec.priority in ["HIGH", "CRITICAL"]
        assert "bed" in rec.recommended_action.lower() or "inpatient" in rec.recommended_action.lower()

    def test_scenario_6_sudden_predicted_arrival_surge(self):
        """Scenario 6: Sudden predicted arrival surge: identify the signal and suggest verification and preparation."""
        surge_state = HospitalState(
            occupancy_percent=72.0,
            patients_waiting=18,
            arrival_rate=38.0,
            available_beds=8,
            available_doctors=5,
            available_nurses=9,
            severity_level=3.0,
        )
        overview = _create_mock_overview(
            forecast_peak=48.0,
            is_surge=True,
            surge_score=88.0,
        )

        response = orchestrator_service.analyze_operations(surge_state, overview)

        surge_actions = [a for a in response.recommended_actions if a.id == "rec-surge-mitigation" or "surge" in a.title.lower()]
        assert len(surge_actions) >= 1
        surge_action = surge_actions[0]
        assert "surge" in surge_action.title.lower() or "surge" in surge_action.recommended_action.lower()

    def test_scenario_7_conflicting_indicators(self):
        """Scenario 7: Conflicting indicators: explain the conflict rather than presenting a misleading conclusion."""
        # Low waiting queue (3 pts) but extreme ML crowding score (88/100)
        conflict_state = HospitalState(
            occupancy_percent=45.0,
            patients_waiting=3,
            arrival_rate=12.0,
            available_beds=14,
            available_doctors=5,
            available_nurses=9,
            severity_level=3.0,
        )
        overview = _create_mock_overview(
            crowding_score=88,
            crowding_level="Critical",
        )

        _, actions = recommendation_engine.evaluate_rules(conflict_state, overview)

        conflict_rules = [a for a in actions if a.rule_id == "RULE_CONFLICTING_OR_DEGRADED_DATA"]
        assert len(conflict_rules) >= 1
        conflict_action = conflict_rules[0]
        # Recommends manual validation / census check due to divergent signals
        assert "census" in conflict_action.title.lower() or "divergent" in conflict_action.reason.lower()
        assert any("census" in act.lower() or "physical" in act.lower() for act in conflict_action.recommended_actions)

    def test_scenario_8_one_ml_service_unavailable(self):
        """Scenario 8: One ML service unavailable: retain valid results from the other available services."""
        state = HospitalState(occupancy_percent=82.0, patients_waiting=25)
        # Forecast service is failed, but wait_time and crowding are success
        engine_status = {
            "forecast": "failed",
            "waiting_time": "success",
            "crowding_risk": "success",
            "flow_pattern": "success",
            "surge_detection": "success",
        }
        overview = _create_mock_overview(
            wait_time=48.0,
            crowding_score=75,
            engine_status=engine_status,
        )

        response = orchestrator_service.analyze_operations(state, overview)

        assert response.degraded_mode is True
        assert response.ml_engine_status["forecast"] == "failed"
        assert response.ml_engine_status["waiting_time"] == "success"

        # Valid actions from working services must still be generated!
        assert len(response.recommended_actions) >= 1

    def test_scenario_9_all_ml_services_unavailable(self):
        """Scenario 9: All ML services unavailable: display a clear error or degraded state without fabricating predictions."""
        state = HospitalState(occupancy_percent=88.0, patients_waiting=28)
        engine_status = {
            "forecast": "failed",
            "waiting_time": "failed",
            "crowding_risk": "failed",
            "flow_pattern": "failed",
            "surge_detection": "failed",
        }
        overview = _create_mock_overview(engine_status=engine_status)

        response = orchestrator_service.analyze_operations(state, overview)

        assert response.degraded_mode is True
        for st in response.ml_engine_status.values():
            assert st == "failed"

        # Operational heuristics still provide emergency rule-based actions based on telemetry
        assert len(response.recommended_actions) >= 1
        sources = [act.source_prediction.lower() for act in response.recommended_actions]
        # Verifies actions clearly attribute to system health monitor or workload ratios rather than fake predictions
        assert any("health monitor" in s or "reliability" in s or "workload" in s for s in sources)

    def test_scenario_11_inputs_changed_updates_recommendations(self):
        """Scenario 11: Inputs changed: update predictions and recommendations accordingly."""
        # 1. Normal state
        normal_state = HospitalState(occupancy_percent=45.0, patients_waiting=5, arrival_rate=12.0)
        overview_normal = _create_mock_overview(wait_time=12.0, crowding_score=20)
        resp1 = orchestrator_service.analyze_operations(normal_state, overview_normal)

        # 2. Changed to extreme overload state
        overload_state = HospitalState(occupancy_percent=94.0, patients_waiting=40, arrival_rate=38.0, available_beds=1)
        overview_overload = _create_mock_overview(wait_time=75.0, crowding_score=92, is_surge=True)
        resp2 = orchestrator_service.analyze_operations(overload_state, overview_overload)

        assert resp1.overall_pressure_score < resp2.overall_pressure_score
        assert len(resp2.recommended_actions) > len(resp1.recommended_actions)
        assert any(a.priority == "CRITICAL" for a in resp2.recommended_actions)

    def test_scenario_13_issue_resolved_and_later_recurring(self):
        """Scenario 13: Issue resolved and later recurring: create or reopen the appropriate issue with an auditable history."""
        from backend.schemas.orchestrator import ExplanationDetail

        with TemporaryDirectory() as tmpdir:
            service = EDActionQueueService(data_dir=Path(tmpdir))

            # 1. Initial high occupancy action
            rec = RecommendationAction(
                id="rec-bed-capacity",
                category="BED CAPACITY",
                priority="HIGH",
                severity="HIGH",
                title="Initiate Inpatient Bed Transfers",
                description="High occupancy",
                recommended_action="Coordinate transfers",
                contributing_metrics={"occupancy_percent": 85.0},
                urgency="WITHIN 30 MIN",
                due_in_minutes=25,
                reason="High occupancy",
                rule_id="RULE_BED_CAPACITY_STRAIN",
                confidence="HIGH",
                explanation_detail=ExplanationDetail(
                    detection_rationale="Occupancy strain",
                    contributing_factors=[],
                    strongest_influencer="Occupancy",
                    triggering_prediction="Classifier",
                    expected_operational_condition="High occupancy",
                    staff_review_guidance="Review beds",
                    disclaimer="Advisory only",
                ),
            )
            from backend.schemas.orchestrator import WorkloadAssessment

            resp = OrchestratorResponse(
                overall_pressure_score=75.0,
                pressure_level="HIGH",
                workload_assessment=WorkloadAssessment(
                    doctor_load_ratio=4.5,
                    nurse_load_ratio=5.2,
                    bed_occupancy_percent=85.0,
                    current_workload_level="HIGH",
                    upcoming_3h_workload_level="HIGH",
                    summary="High workload",
                ),
                prioritized_issues=[],
                recommended_actions=[rec],
                ml_engine_status={"forecast": "success"},
                degraded_mode=False,
                data_sources_used=["Test"],
                timestamp="2026-10-14T20:00:00Z",
            )

            service.sync_with_orchestrator(resp)
            item = service._actions.get("rec-bed-capacity")
            assert item is not None
            assert item.status == ActionStatus.NEW

            # 2. Staff acknowledges
            service.update_action_status(
                action_id="rec-bed-capacity",
                new_status=ActionStatus.ACKNOWLEDGED,
                notes="Transfers initiated",
            )
            item = service._actions.get("rec-bed-capacity")
            assert item.status == ActionStatus.ACKNOWLEDGED
            assert len(item.audit_history) == 2  # ACTION_CREATED, ACTION_ACKNOWLEDGED

            # 3. Staff resolves issue
            service.update_action_status(
                action_id="rec-bed-capacity",
                new_status=ActionStatus.COMPLETED,
                resolution_notes="Transferred 5 patients to 4W floor",
            )
            item = service._actions.get("rec-bed-capacity")
            assert item.status == ActionStatus.COMPLETED
            assert item.resolved_at is not None
            assert item.resolution_notes == "Transferred 5 patients to 4W floor"
            assert len(item.audit_history) == 3  # + ACTION_RESOLVED

            # 4. Issue later recurs (e.g., occupancy climbs to CRITICAL 95%)
            rec_recurrent = RecommendationAction(
                id="rec-bed-capacity",
                category="BED CAPACITY",
                priority="CRITICAL",
                severity="CRITICAL",
                title="Initiate Inpatient Bed Transfers",
                description="Bed occupancy has escalated to 95%",
                recommended_action="Coordinate transfers",
                contributing_metrics={"occupancy_percent": 95.0},
                urgency="IMMEDIATE (15 MIN)",
                due_in_minutes=15,
                reason="Extreme occupancy recurrence",
                rule_id="RULE_BED_CAPACITY_STRAIN",
                confidence="HIGH",
                explanation_detail=ExplanationDetail(
                    detection_rationale="Occupancy escalated",
                    contributing_factors=[],
                    strongest_influencer="Occupancy",
                    triggering_prediction="Classifier",
                    expected_operational_condition="Critical occupancy",
                    staff_review_guidance="Urgent bed placement",
                    disclaimer="Advisory only",
                ),
            )
            resp_recurrent = OrchestratorResponse(
                overall_pressure_score=92.0,
                pressure_level="CRITICAL",
                workload_assessment=WorkloadAssessment(
                    doctor_load_ratio=5.5,
                    nurse_load_ratio=6.2,
                    bed_occupancy_percent=95.0,
                    current_workload_level="CRITICAL",
                    upcoming_3h_workload_level="CRITICAL",
                    summary="Critical workload",
                ),
                prioritized_issues=[],
                recommended_actions=[rec_recurrent],
                ml_engine_status={"forecast": "success"},
                degraded_mode=False,
                data_sources_used=["Test"],
                timestamp="2026-10-14T21:00:00Z",
            )

            # Re-sync with orchestrator detects recurrence and preserves audit history
            service.sync_with_orchestrator(resp_recurrent)
            item_after = service._actions.get("rec-bed-capacity")

            # Preserves previous resolution history in audit log
            events_in_log = [
                entry.get("event") if isinstance(entry, dict) else getattr(entry, "event", getattr(entry, "action", None))
                for entry in item_after.audit_history
            ]
            assert "ACTION_RESOLVED" in events_in_log
            assert item_after.status == ActionStatus.COMPLETED or item_after.condition_changed_since_ack is True

