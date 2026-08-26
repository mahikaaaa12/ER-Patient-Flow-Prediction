import logging
from fastapi import APIRouter, HTTPException, status
from ..schemas.hospital_state import HospitalState
from ..schemas.deep_learning import ArrivalForecastResponse
from ..services.deep_learning_service import deep_learning_service

logger = logging.getLogger("erflow.deep_learning_router")

router = APIRouter(prefix="/api", tags=["Deep Learning (LSTM)"])


@router.post(
    "/predict/deep-learning",
    response_model=ArrivalForecastResponse,
    summary="Multi-horizon patient arrival forecast (LSTM)"
)
async def predict_deep_learning(state: HospitalState):
    """Run LSTM neural network model for multi-horizon cumulative arrival forecasts."""
    try:
        return deep_learning_service.forecast_arrivals(state)
    except Exception as e:
        logger.error(f"Error in deep learning forecast: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deep learning forecast failed: {str(e)}"
        )


@router.post(
    "/forecast/arrivals",
    response_model=ArrivalForecastResponse,
    summary="Alias for arrival forecast"
)
async def forecast_arrivals(state: HospitalState):
    """Alias route for patient arrival forecasting."""
    try:
        return deep_learning_service.forecast_arrivals(state)
    except Exception as e:
        logger.error(f"Error in forecast arrivals: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Arrival forecast failed: {str(e)}"
        )
