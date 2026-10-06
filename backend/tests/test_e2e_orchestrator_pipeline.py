import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
_CHATBOT = _ROOT / "chatbot"
if str(_CHATBOT) not in sys.path:
    sys.path.insert(0, str(_CHATBOT))

import pytest
from backend.schemas.hospital_state import HospitalState
from backend.services.orchestrator_service import orchestrator_service
from backend.services.overview_service import overview_service
from backend.services.action_queue_service import action_queue_service
from backend.schemas.overview import AssistantQueryRequest
from app.chatbot.chatbot_service import chatbot_service
from app.schemas.chat_schema import ChatRequest


def test_e2e_flow_baseline_low_pressure():
    """Test 1: Low ER demand baseline."""
    low_state = HospitalState(
        occupancy_percent=50.0,
        patients_waiting=10.0,
        arrival_rate=15.0,
        available_beds=10.0,
        available_doctors=5.0,
        available_nurses=10.0,
    )
    orch_res = orchestrator_service.analyze_operations(low_state)
    assert orch_res.pressure_level in ["LOW", "MODERATE"]
    assert orch_res.overall_pressure_score < 60.0
    assert orch_res.workload_assessment.doctor_load_ratio == 2.0  # 10 / 5
    assert orch_res.workload_assessment.nurse_load_ratio == 2.8  # (10 + 17.5 occupied beds) / 10


def test_e2e_flow_high_strain_transition():
    """Test 2: Transition from low demand to extreme high strain (50% -> 90% occ, 10 -> 35 waiting, 15 -> 35 arrivals, 10 -> 2 beds)."""
    high_state = HospitalState(
        occupancy_percent=90.0,
        patients_waiting=35.0,
        arrival_rate=35.0,
        available_beds=2.0,
        available_doctors=3.0,
        available_nurses=5.0,
    )
    orch_res = orchestrator_service.analyze_operations(high_state)

    # 1. Operational Pressure
    assert orch_res.pressure_level == "CRITICAL"
    assert orch_res.overall_pressure_score > 75.0

    # 2. Resource Ratios
    assert orch_res.workload_assessment.doctor_load_ratio == 11.7  # 35 / 3
    assert orch_res.workload_assessment.nurse_load_ratio == 13.3  # (35 + 31.5) / 5

    # 3. Prioritized Issues
    categories = [iss.category for iss in orch_res.prioritized_issues]
    assert "BED CAPACITY" in categories
    assert "WAITING QUEUE" in categories
    assert "STAFFING" in categories

    # 4. Recommended Actions & XAI Explanations
    assert len(orch_res.recommended_actions) >= 2
    bed_rec = next((r for r in orch_res.recommended_actions if r.category == "BED CAPACITY"), None)
    assert bed_rec is not None
    assert bed_rec.explanation_detail is not None
    assert bed_rec.explanation_detail.detection_rationale is not None
    assert bed_rec.explanation_detail.strongest_influencer is not None

    # 5. Action Queue Sync
    action_res = action_queue_service.get_action_queue(high_state, "ALL")
    assert action_res.summary.open_actions > 0
    assert action_res.summary.high_priority > 0


def test_e2e_flow_ai_assistant_integration():
    """Test 3: AI Assistant querying high strain orchestrator state."""
    high_state = HospitalState(
        occupancy_percent=90.0,
        patients_waiting=35.0,
        arrival_rate=35.0,
        available_beds=2.0,
        available_doctors=3.0,
        available_nurses=5.0,
    )
    query_req = AssistantQueryRequest(
        question="What's the biggest issue right now?",
        hospital_state=high_state.model_dump(),
    )
    assistant_res = overview_service.answer_assistant_query(query_req)
    assert "CRITICAL" in assistant_res.text
    assert "BED CAPACITY" in assistant_res.text or "TRIAGE CAPACITY" in assistant_res.text
    assert "CURRENT DATA" in assistant_res.text
    assert "FORECAST" in assistant_res.text
    assert "SIMULATION" in assistant_res.text
    assert "GENERAL GUIDANCE" in assistant_res.text

    # Chatbot endpoint
    chat_req = ChatRequest(
        message="Why is workload high?",
        context=high_state.model_dump(),
    )
    chat_res = chatbot_service.process_message(chat_req)
    assert "CRITICAL" in chat_res.response or "HIGH" in chat_res.response
    assert "Overall Pressure" in chat_res.response or "Occupancy" in chat_res.response
