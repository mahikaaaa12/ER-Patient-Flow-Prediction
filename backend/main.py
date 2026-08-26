import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .services.artifact_loader import artifact_loader
from .routers import (
    supervised_router,
    unsupervised_router,
    deep_learning_router,
    overview_router,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("erflow.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML artifacts on application startup."""
    logger.info("Initializing ERFlow ML Inference Backend...")
    try:
        artifact_loader.load_all()
        logger.info("All ML model artifacts loaded and verified.")
    except Exception as e:
        logger.error(f"Critical error loading model artifacts during startup: {e}", exc_info=True)
        raise RuntimeError(f"Model initialization failed: {e}")
    yield
    logger.info("Shutting down ERFlow ML Inference Backend.")


app = FastAPI(
    title="ERFlow ML Inference API",
    description="Backend API serving Supervised (XGBoost), Deep Learning (LSTM), and Unsupervised (K-Means/DBSCAN) models for emergency department operations.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for local React / Vite frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(supervised_router)
app.include_router(unsupervised_router)
app.include_router(deep_learning_router)
app.include_router(overview_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global catch-all exception handler to avoid exposing raw tracebacks."""
    logger.error(f"Unhandled server error at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred during model inference. Please check input parameters.",
            "path": request.url.path,
        }
    )


@app.get("/api/health", tags=["System"])
async def health_check():
    """Verify backend health and model loading status."""
    return {
        "status": "healthy" if artifact_loader.is_loaded else "degraded",
        "service": "ERFlow ML Inference Engine",
        "ml_model_available": artifact_loader.is_loaded,
        "artifacts_loaded": artifact_loader.is_loaded,
        "registered_models": [
            "waiting_time_model",
            "crowding_model",
            "high_demand_model",
            "flow_pattern_model",
            "patient_volume_model"
        ],
        "models": {
            "supervised": {
                "waiting_time_model": artifact_loader.xgb_regressor is not None,
                "crowding_model": artifact_loader.xgb_classifier is not None,
                "xgboost_regressor": artifact_loader.xgb_regressor is not None,
                "xgboost_classifier": artifact_loader.xgb_classifier is not None,
                "preprocessor": artifact_loader.supervised_preprocessor is not None,
                "label_encoder": artifact_loader.label_encoder is not None,
            },
            "unsupervised": {
                "flow_pattern_model": artifact_loader.kmeans_model is not None,
                "high_demand_model": len(artifact_loader.dbscan_params) > 0,
                "kmeans_clusterer": artifact_loader.kmeans_model is not None,
                "scaler": artifact_loader.unsupervised_scaler is not None,
                "pca_projector": artifact_loader.pca_model is not None,
                "cluster_profiles_loaded": len(artifact_loader.cluster_profiles) > 0,
                "dbscan_params_loaded": len(artifact_loader.dbscan_params) > 0,
            },
            "deep_learning": {
                "patient_volume_model": artifact_loader.lstm_model is not None,
                "lstm_keras_model": artifact_loader.lstm_model is not None,
                "feature_scaler": artifact_loader.lstm_feature_scaler is not None,
                "target_scaler": artifact_loader.lstm_target_scaler is not None,
                "config_loaded": len(artifact_loader.lstm_config) > 0,
            },
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
