import pytest
from app.ml_service.model_adapters import load_real_models

@pytest.fixture(scope="session", autouse=True)
def initialize_real_ml_models():
    """Ensure real ML models are loaded into registry prior to test execution."""
    load_real_models()
