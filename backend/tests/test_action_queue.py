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
from backend.schemas.action_queue import ActionStatus
from backend.services.action_queue_service import action_queue_service
from backend.services.orchestrator_service import orchestrator_service


def test_action_queue_sync_and_persistence():
    state = HospitalState(occupancy_percent=92.0, patients_waiting=35.0)
    res = action_queue_service.get_action_queue(state, "ALL")

    assert res is not None
    assert res.summary.total_actions > 0
    assert res.summary.open_actions > 0
    assert len(res.actions) > 0

    first_item = res.actions[0]
    assert first_item.status == ActionStatus.NEW
    assert first_item.source_prediction is not None
    assert len(first_item.contributing_factors) > 0

    # Test status update (NEW -> ACKNOWLEDGED)
    updated = action_queue_service.update_action_status(first_item.id, ActionStatus.ACKNOWLEDGED)
    assert updated.status == ActionStatus.ACKNOWLEDGED

    # Test status update (ACKNOWLEDGED -> MONITORING)
    updated_mon = action_queue_service.update_action_status(first_item.id, ActionStatus.MONITORING)
    assert updated_mon.status == ActionStatus.MONITORING

    # Test status update (MONITORING -> COMPLETED)
    updated_comp = action_queue_service.update_action_status(first_item.id, ActionStatus.COMPLETED)
    assert updated_comp.status == ActionStatus.COMPLETED

    # Verify filtering
    res_completed = action_queue_service.get_action_queue(None, "COMPLETED")
    assert any(a.id == first_item.id for a in res_completed.actions)

    res_high = action_queue_service.get_action_queue(None, "HIGH PRIORITY")
    assert all(a.priority in ["HIGH", "CRITICAL"] for a in res_high.actions)
