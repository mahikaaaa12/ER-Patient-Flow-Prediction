import os
from pathlib import Path
from app.core.config import Settings, settings
from app.ml_service.model_registry import ModelRegistry


def test_default_config_loading():
    config = Settings()
    assert config.APP_NAME == "ER Patient Flow AI Chatbot"
    assert config.API_PORT == 8001
    assert config.API_HOST == "0.0.0.0"
    assert config.ENVIRONMENT == "development"
    assert config.DEBUG is True
    assert config.MODEL_VERSION == "1.0.0"


def test_relative_model_paths():
    config = Settings()
    paths = config.model_paths

    assert "patient_volume_model" in paths
    assert "waiting_time_model" in paths
    assert "crowding_model" in paths
    assert "high_demand_model" in paths

    # Verify paths are relative, not hardcoded absolute Windows paths
    for name, p in paths.items():
        assert isinstance(p, Path)
        assert not p.is_absolute(), f"Path {p} should be relative, not absolute."


def test_missing_model_files_do_not_crash():
    config = Settings()
    # Check that model existence check runs safely even when files don't exist
    existence = config.check_configured_models()
    assert isinstance(existence, dict)
    assert "patient_volume_model" in existence


def test_model_registry_resilience_to_missing_model_files():
    # Instantiating registry should inspect missing files and log warnings without raising any exceptions
    registry = ModelRegistry()
    assert registry.list_models() == []
    assert registry.get_unified_interface() is None


def test_custom_environment_variable_override(monkeypatch):
    monkeypatch.setenv("API_PORT", "9050")
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("MODEL_VERSION", "2.1.0")
    monkeypatch.setenv("PATIENT_VOLUME_MODEL_PATH", "./custom_models/vol_v2.pkl")

    custom_settings = Settings()
    assert custom_settings.API_PORT == 9050
    assert custom_settings.ENVIRONMENT == "staging"
    assert custom_settings.MODEL_VERSION == "2.1.0"
    assert custom_settings.PATIENT_VOLUME_MODEL_PATH == "./custom_models/vol_v2.pkl"
    assert not Path(custom_settings.PATIENT_VOLUME_MODEL_PATH).is_absolute()
