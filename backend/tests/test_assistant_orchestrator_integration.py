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
from backend.schemas.overview import AssistantQueryRequest
from backend.services.overview_service import overview_service
from app.chatbot.chatbot_service import chatbot_service
from app.schemas.chat_schema import ChatRequest
from app.schemas.prediction_schema import Intent


def test_assistant_query_orchestrator_biggest_issue():
    state = HospitalState(
        occupancy_percent=88.0,
        patients_waiting=30.0,
        available_beds=3.0,
        arrival_rate=35.0,
        available_doctors=3.0,
        available_nurses=5.0,
    )
    req = AssistantQueryRequest(
        question="What's the biggest issue right now?",
        hospital_state=state.model_dump(),
    )
    resp = overview_service.answer_assistant_query(req)
    assert resp is not None
    assert "ED Operations Command Center Assessment" in resp.text
    assert "CURRENT DATA" in resp.text
    assert "FORECAST" in resp.text
    assert "RECOMMENDED OPERATIONAL ACTION" in resp.text
    assert "SIMULATION" in resp.text
    assert "GENERAL GUIDANCE" in resp.text
    assert len(resp.insights) > 0


def test_assistant_query_workload_rationale():
    state = HospitalState(occupancy_percent=85.0, patients_waiting=25.0)
    req = AssistantQueryRequest(
        question="Why is workload high?",
        hospital_state=state.model_dump(),
    )
    resp = overview_service.answer_assistant_query(req)
    assert "Workload & Pressure Rationale" in resp.text
    assert "Doctor Load Ratio" in resp.text
    assert "Nurse Load Ratio" in resp.text


def test_assistant_query_upcoming_monitoring():
    state = HospitalState()
    req = AssistantQueryRequest(
        question="What should staff monitor next over the next two hours?",
        hospital_state=state.model_dump(),
    )
    resp = overview_service.answer_assistant_query(req)
    assert "Upcoming Workload & Monitoring Trajectory" in resp.text
    assert "Projected Peak" in resp.text


def test_assistant_query_triage_capacity_flagged():
    state = HospitalState(patients_waiting=35.0)
    req = AssistantQueryRequest(
        question="Why is triage capacity being flagged?",
        hospital_state=state.model_dump(),
    )
    resp = overview_service.answer_assistant_query(req)
    assert "Triage Capacity Rationale" in resp.text
    assert "XAI EXPLANATION" in resp.text


def test_assistant_query_simulate_adding_nurse():
    state = HospitalState(available_nurses=4.0, patients_waiting=20.0)
    req = AssistantQueryRequest(
        question="Can I simulate adding a nurse?",
        hospital_state=state.model_dump(),
    )
    resp = overview_service.answer_assistant_query(req)
    assert "Scenario Simulation Guidance" in resp.text
    assert "Scenario Simulator" in resp.text


def test_chatbot_service_process_message_operational_command():
    req = ChatRequest(
        message="What is the biggest operational concern?",
        context={
            "occupancy_percent": 82.0,
            "patients_waiting": 22.0,
            "available_beds": 4.0,
            "arrival_rate": 28.0,
            "available_doctors": 3.0,
            "available_nurses": 5.0,
        }
    )
    resp = chatbot_service.process_message(req)
    assert resp is not None
    assert resp.intent == Intent.OPERATIONAL_COMMAND.value
    assert "CURRENT DATA" in resp.response
    assert "FORECAST" in resp.response
    assert "SIMULATION" in resp.response
    assert "GENERAL GUIDANCE" in resp.response
