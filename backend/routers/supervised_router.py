import logging
from fastapi import APIRouter, HTTPException, status
from ..schemas.hospital_state import HospitalState
from ..schemas.supervised import (
    WaitingTimeResponse,
    CrowdingRiskResponse,
    SupervisedPredictionResponse,
)
from ..services.supervised_service import supervised_service

logger = logging.getLogger("erflow.supervised_router")

router = APIRouter(prefix="/api", tags=["Supervised Learning"])


@router.post(
    "/predict/supervised",
    response_model=SupervisedPredictionResponse,
    summary="Predict both waiting time and crowding risk"
)
async def predict_supervised(state: HospitalState):
    """Run both XGBoost Regressor and Classifier on the provided hospital state."""
    try:
        return supervised_service.predict_all(state)
    except Exception as e:
        logger.error(f"Error in supervised prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supervised model inference failed: {str(e)}"
        )


@router.post(
    "/predict/waiting-time",
    response_model=WaitingTimeResponse,
    summary="Predict waiting time in minutes"
)
async def predict_waiting_time(state: HospitalState):
    """Run XGBoost Regressor to predict waiting time."""
    try:
        return supervised_service.predict_waiting_time(state)
    except Exception as e:
        logger.error(f"Error in waiting time prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Waiting time prediction failed: {str(e)}"
        )


@router.post(
    "/predict/crowding-risk",
    response_model=CrowdingRiskResponse,
    summary="Predict emergency department crowding risk"
)
async def predict_crowding_risk(state: HospitalState):
    """Run XGBoost Classifier to predict multi-class crowding level."""
    try:
        return supervised_service.predict_crowding_risk(state)
    except Exception as e:
        logger.error(f"Error in crowding risk prediction: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Crowding risk prediction failed: {str(e)}"
        )
