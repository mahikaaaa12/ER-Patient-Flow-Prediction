from pathlib import Path
from typing import Dict, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ==========================================
    # API & Application Server Configuration
    # ==========================================
    APP_NAME: str = Field(default="ER Patient Flow AI Chatbot", description="Application name")
    ENVIRONMENT: str = Field(default="development", description="Environment (development, staging, production)")
    APP_ENV: str = Field(default="development", description="Alias for environment")
    DEBUG: bool = Field(default=True, description="Enable FastAPI debug mode and auto-reload")
    API_HOST: str = Field(default="0.0.0.0", description="API bind host")
    API_PORT: int = Field(default=8001, description="API bind port")
    HOST: str = Field(default="0.0.0.0", description="Alias for API host")
    PORT: int = Field(default=8001, description="Alias for API port")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level (DEBUG, INFO, WARNING, ERROR)")
    MAX_HISTORY_PER_SESSION: int = Field(default=50, description="Max conversation turns preserved per session")

    # ==========================================
    # ML Model Directory & Artifact Paths
    # (Configurable, relative paths, no hardcoded absolute paths)
    # ==========================================
    MODEL_DIR: str = Field(default="./models", description="Base directory containing trained model files")
    MODEL_REGISTRY_PATH: str = Field(default="./models", description="Alias for model directory")
    MODEL_VERSION: str = Field(default="1.0.0", description="Target model release version")

    PATIENT_VOLUME_MODEL_PATH: str = Field(
        default="./models/patient_volume_model.pkl",
        description="Relative path to trained patient volume forecast model artifact",
    )
    WAITING_TIME_MODEL_PATH: str = Field(
        default="./models/waiting_time_model.pkl",
        description="Relative path to trained waiting time prediction model artifact",
    )
    CROWDING_MODEL_PATH: str = Field(
        default="./models/crowding_model.pkl",
        description="Relative path to trained ED crowding prediction model artifact",
    )
    HIGH_DEMAND_MODEL_PATH: str = Field(
        default="./models/high_demand_model.pkl",
        description="Relative path to trained high-demand surge prediction model artifact",
    )

    # Developer Mock Mode (FOR TESTING / DEVELOPMENT PIPELINE ONLY)
    USE_MOCK_MODE: bool = Field(default=False, description="Enable development mock ML provider for architecture testing")
    USE_MOCK_MODELS: bool = Field(default=False, description="Alias for USE_MOCK_MODE")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def model_paths(self) -> Dict[str, Path]:
        """Returns resolved Path objects for each model artifact."""
        return {
            "patient_volume_model": Path(self.PATIENT_VOLUME_MODEL_PATH),
            "waiting_time_model": Path(self.WAITING_TIME_MODEL_PATH),
            "crowding_model": Path(self.CROWDING_MODEL_PATH),
            "high_demand_model": Path(self.HIGH_DEMAND_MODEL_PATH),
        }

    def check_configured_models(self) -> Dict[str, bool]:
        """Checks if configured model files exist on disk without failing."""
        return {name: path.exists() for name, path in self.model_paths.items()}


# Global settings singleton instance
settings = Settings()
