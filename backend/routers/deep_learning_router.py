import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
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
async def predict_deep_learning(
    state: HospitalState,
    horizon: str = Query("24h", description="Forecast horizon: 24h, 7d, 30d")
):
    """Run LSTM neural network model for multi-horizon arrival forecasts."""
    try:
        return await asyncio.to_thread(deep_learning_service.forecast_arrivals, state, horizon=horizon)
    except Exception as e:
        logger.error(f"Error in deep learning forecast: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deep learning forecast failed: {str(e)}"
        )


@router.get(
    "/predict/deep-learning",
    response_model=ArrivalForecastResponse,
    summary="Get multi-horizon patient arrival forecast (LSTM)"
)
async def get_predict_deep_learning(
    horizon: str = Query("24h", description="Forecast horizon: 24h, 7d, 30d")
):
    """GET endpoint for multi-horizon arrival forecast."""
    try:
        state = HospitalState()
        return await asyncio.to_thread(deep_learning_service.forecast_arrivals, state, horizon=horizon)
    except Exception as e:
        logger.error(f"Error in GET deep learning forecast: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deep learning forecast failed: {str(e)}"
        )


@router.post(
    "/forecast/arrivals",
    response_model=ArrivalForecastResponse,
    summary="Alias for arrival forecast"
)
async def forecast_arrivals(
    state: HospitalState,
    horizon: str = Query("24h", description="Forecast horizon: 24h, 7d, 30d")
):
    """Alias route for patient arrival forecasting."""
    try:
        return await asyncio.to_thread(deep_learning_service.forecast_arrivals, state, horizon=horizon)
    except Exception as e:
        logger.error(f"Error in forecast arrivals: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Arrival forecast failed: {str(e)}"
        )


@router.get(
    "/forecast/arrivals",
    response_model=ArrivalForecastResponse,
    summary="Alias GET endpoint for arrival forecast"
)
async def get_forecast_arrivals(
    horizon: str = Query("24h", description="Forecast horizon: 24h, 7d, 30d")
):
    """GET alias route for patient arrival forecasting."""
    try:
        state = HospitalState()
        return await asyncio.to_thread(deep_learning_service.forecast_arrivals, state, horizon=horizon)
    except Exception as e:
        logger.error(f"Error in GET forecast arrivals: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Arrival forecast failed: {str(e)}"
        )
