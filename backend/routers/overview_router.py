import logging
from fastapi import APIRouter, HTTPException, status
from ..schemas.hospital_state import HospitalState
from ..schemas.overview import (
    DashboardOverviewResponse,
    AssistantQueryRequest,
    AssistantQueryResponse,
)
from ..services.overview_service import overview_service

logger = logging.getLogger("erflow.overview_router")

router = APIRouter(prefix="/api", tags=["Overview & AI Assistant"])


@router.post(
    "/dashboard/overview",
    response_model=DashboardOverviewResponse,
    summary="Get aggregated outputs across all 5 ML models"
)
async def get_dashboard_overview(state: HospitalState):
    """Aggregate multi-model predictions for the entire dashboard in a single call."""
    try:
        return overview_service.get_overview(state)
    except Exception as e:
        logger.error(f"Error in dashboard overview: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dashboard overview aggregation failed: {str(e)}"
        )


@router.get(
    "/dashboard/overview",
    response_model=DashboardOverviewResponse,
    summary="Get aggregated outputs using current/default hospital state"
)
async def get_default_dashboard_overview():
    """Default GET overview endpoint for dashboard initial load."""
    try:
        default_state = HospitalState()
        return overview_service.get_overview(default_state)
    except Exception as e:
        logger.error(f"Error in default dashboard overview: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dashboard overview aggregation failed: {str(e)}"
        )


@router.post(
    "/ai-assistant/query",
    response_model=AssistantQueryResponse,
    summary="Conversational query handler powered by real-time ML state"
)
async def query_ai_assistant(query_req: AssistantQueryRequest):
    """Answer operational questions dynamically using underlying ML models."""
    try:
        return overview_service.answer_assistant_query(query_req)
    except Exception as e:
        logger.error(f"Error in AI assistant query: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI assistant query failed: {str(e)}"
        )
