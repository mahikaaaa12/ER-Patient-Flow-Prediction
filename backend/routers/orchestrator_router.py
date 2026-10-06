import asyncio
import logging
from fastapi import APIRouter, HTTPException, status
from ..schemas.hospital_state import HospitalState
from ..schemas.orchestrator import OrchestratorRequest, OrchestratorResponse
from ..services.orchestrator_service import orchestrator_service

logger = logging.getLogger("erflow.orchestrator_router")

router = APIRouter(prefix="/api", tags=["ED Command & Workload Orchestrator"])


@router.post(
    "/orchestrator/analyze",
    response_model=OrchestratorResponse,
    summary="Evaluate ED workload strain, prioritized issues, and resource recommendations"
)
async def analyze_ed_operations(state: HospitalState):
    """
    Evaluates real ER operational telemetry and consumes outputs from all 5 ML models
    (LSTM forecast, XGBoost Regressor, XGBoost Classifier, K-Means flow patterns, DBSCAN surge)
    to generate a unified workload strain score, staffing ratios, prioritized issues, and
    department-level resource recommendations.
    """
    try:
        return await asyncio.to_thread(orchestrator_service.analyze_operations, state)
    except Exception as e:
        logger.error(f"Error in ED Command Orchestrator analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ED Command Orchestrator evaluation failed: {str(e)}"
        )


@router.get(
    "/orchestrator/analyze",
    response_model=OrchestratorResponse,
    summary="Get orchestrator evaluation using default hospital state"
)
async def get_default_ed_orchestrator_analysis():
    """Default GET endpoint for initial loading of Orchestrator state."""
    try:
        default_state = HospitalState()
        return await asyncio.to_thread(orchestrator_service.analyze_operations, default_state)
    except Exception as e:
        logger.error(f"Error in default ED Orchestrator evaluation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ED Command Orchestrator evaluation failed: {str(e)}"
        )


@router.post(
    "/operations/orchestrator",
    response_model=OrchestratorResponse,
    summary="Alias endpoint for ED Command Orchestrator"
)
async def analyze_ed_operations_alias(state: HospitalState):
    """Alias route supporting /api/operations/orchestrator."""
    return await analyze_ed_operations(state)


# ==============================================================================
# ACTION QUEUE ENDPOINTS
# ==============================================================================

from ..schemas.action_queue import (
    ActionQueueResponse,
    ActionItem,
    UpdateActionStatusRequest,
    ActionStatus,
)
from ..services.action_queue_service import action_queue_service


@router.get(
    "/orchestrator/action-queue",
    response_model=ActionQueueResponse,
    summary="Get operational action queue items and summary metrics"
)
async def get_action_queue(filter_status: str = "ALL"):
    """
    Retrieves current Action Queue tasks filtered by status (ALL, HIGH PRIORITY, NEW, ACKNOWLEDGED, COMPLETED).
    Includes summary metrics (open_actions, high_priority, completed).
    """
    try:
        return await asyncio.to_thread(action_queue_service.get_action_queue, None, filter_status)
    except Exception as e:
        logger.error(f"Error fetching action queue: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not retrieve action queue: {str(e)}"
        )


@router.post(
    "/orchestrator/action-queue",
    response_model=ActionQueueResponse,
    summary="Sync action queue with current hospital state and retrieve items"
)
async def sync_action_queue(state: HospitalState, filter_status: str = "ALL"):
    """
    Evaluates current ER state, syncs new recommendations into Action Queue, and returns filtered task items.
    """
    try:
        return await asyncio.to_thread(action_queue_service.get_action_queue, state, filter_status)
    except Exception as e:
        logger.error(f"Error syncing action queue: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not sync action queue: {str(e)}"
        )


@router.patch(
    "/orchestrator/action-queue/{action_id}/status",
    response_model=ActionItem,
    summary="Update action status (NEW -> ACKNOWLEDGED -> MONITORING -> COMPLETED)"
)
async def update_action_status(action_id: str, payload: UpdateActionStatusRequest):
    """
    Updates the state of an action item in the persistent JSON store.
    Accepts: {"status": "ACKNOWLEDGED"} or "MONITORING" or "COMPLETED" or "NEW".
    """
    try:
        return await asyncio.to_thread(action_queue_service.update_action_status, action_id, payload.status)
    except KeyError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating action status for '{action_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update action status: {str(e)}"
        )
