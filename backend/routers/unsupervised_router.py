import logging
from fastapi import APIRouter, HTTPException, status
from ..schemas.hospital_state import HospitalState
from ..schemas.unsupervised import (
    FlowPatternResponse,
    SurgeDetectionResponse,
    UnsupervisedPredictionResponse,
)
from ..services.unsupervised_service import unsupervised_service

logger = logging.getLogger("erflow.unsupervised_router")

router = APIRouter(prefix="/api", tags=["Unsupervised Learning"])


@router.post(
    "/predict/unsupervised",
    response_model=UnsupervisedPredictionResponse,
    summary="Run flow pattern clustering and surge detection"
)
async def predict_unsupervised(state: HospitalState):
    """Run both K-Means pattern discovery and DBSCAN surge detector."""
    try:
        return unsupervised_service.predict_all(state)
    except Exception as e:
        logger.error(f"Error in unsupervised prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unsupervised model inference failed: {str(e)}"
        )


@router.post(
    "/patterns/flow",
    response_model=FlowPatternResponse,
    summary="Identify patient flow cluster and coordinates"
)
async def get_flow_pattern(state: HospitalState):
    """Run K-Means clustering and PCA projection."""
    try:
        return unsupervised_service.predict_flow_pattern(state)
    except Exception as e:
        logger.error(f"Error in flow pattern discovery: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow pattern discovery failed: {str(e)}"
        )


@router.post(
    "/surge/detect",
    response_model=SurgeDetectionResponse,
    summary="Detect patient arrival surge / operational anomaly"
)
async def detect_surge(state: HospitalState):
    """Run DBSCAN anomaly detection against baseline."""
    try:
        return unsupervised_service.detect_surge(state)
    except Exception as e:
        logger.error(f"Error in surge detection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Surge detection failed: {str(e)}"
        )
