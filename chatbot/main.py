import logging
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.chat_routes import router as chat_router
from app.api.dashboard_routes import router as dashboard_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.ml_service.model_adapters import load_real_models
from app.ml_service.model_registry import model_registry

# Initialize logging configuration
setup_logging()
logger = logging.getLogger("chatbot.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    mode_str = "MOCK MODE (DEVELOPMENT PIPELINE)" if (settings.USE_MOCK_MODE or settings.USE_MOCK_MODELS) else "REAL MODEL MODE ACTIVE"
    logger.info(f"Starting {settings.APP_NAME} in [{mode_str}]...")

    if not (settings.USE_MOCK_MODE or settings.USE_MOCK_MODELS):
        logger.info("REAL MODEL MODE ACTIVE: Loading trained ML model adapters...")
        load_real_models()

    registered = model_registry.list_models()
    logger.info(f"[{mode_str}] Registered ML models: {registered} (Count: {len(registered)})")
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "AI-Based Emergency Room Patient Flow Prediction Chatbot & Dashboard API. "
        "Provides an intelligent conversational and dashboard API for querying ER patient volume, "
        "waiting time, crowding levels, and high-demand forecasts."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(chat_router, prefix="/api")
app.include_router(dashboard_router)


@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def global_health_check():
    """
    System health check endpoint exposing individual model statuses,
    active ML inference mode (REAL or MOCK), and registry health.
    """
    registered = model_registry.list_models()
    has_unified = model_registry.get_unified_interface() is not None
    health_status = model_registry.get_model_health_status()
    active_mode = "MOCK" if (settings.USE_MOCK_MODE or settings.USE_MOCK_MODELS) else "REAL"

    wt_loaded = health_status.get("waiting_time_model", {}).get("loaded_status") == "loaded"
    cr_loaded = health_status.get("crowding_model", {}).get("loaded_status") == "loaded"
    fl_loaded = health_status.get("flow_pattern_model", {}).get("loaded_status") == "loaded"
    hd_loaded = health_status.get("high_demand_model", {}).get("loaded_status") == "loaded"
    pv_loaded = health_status.get("patient_volume_model", {}).get("loaded_status") == "loaded"

    models_dict = {
        "supervised": {
            "waiting_time_model": wt_loaded,
            "crowding_model": cr_loaded,
            "xgboost_regressor": wt_loaded,
            "xgboost_classifier": cr_loaded,
        },
        "unsupervised": {
            "flow_pattern_model": fl_loaded,
            "high_demand_model": hd_loaded,
            "kmeans_clusterer": fl_loaded,
            "dbscan_params": hd_loaded,
        },
        "deep_learning": {
            "patient_volume_model": pv_loaded,
            "lstm_keras_model": pv_loaded,
        },
        "registered_details": health_status,
    }

    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "mode": active_mode,
        "ml_mode": active_mode,
        "ml_model_available": len(registered) > 0 or has_unified,
        "artifacts_loaded": len(registered) > 0 or has_unified,
        "registered_models": registered,
        "models": models_dict,
    }


@app.get("/", tags=["Root"])
async def root():
    active_mode = "MOCK" if (settings.USE_MOCK_MODE or settings.USE_MOCK_MODELS) else "REAL"
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": "0.1.0",
        "mode": active_mode,
        "endpoints": {
            "chat": "POST /api/chat",
            "health": "GET /api/health",
            "dashboard_overview": "GET /api/dashboard/overview",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.API_HOST or settings.HOST,
        port=settings.API_PORT or settings.PORT,
        reload=settings.DEBUG,
    )
