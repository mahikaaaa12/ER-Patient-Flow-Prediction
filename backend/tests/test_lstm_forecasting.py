import pytest
import numpy as np
from backend.schemas.hospital_state import HospitalState
from backend.services.deep_learning_service import deep_learning_service
from backend.services.artifact_loader import artifact_loader

artifact_loader.load_all()


def test_backend_lstm_forecasting_uses_real_data():
    state = HospitalState(arrival_rate=28.0, hour_of_day=14, day_of_week=3, month=6)
    resp = deep_learning_service.forecast_arrivals(state, horizon="24h")

    assert "LSTM" in resp.model_name
    assert "REAL HISTORICAL DATA" in resp.data_source
    assert resp.validation_metrics is not None
    assert resp.validation_metrics["1h_mae"] == 3.39
    assert resp.validation_metrics["3h_mae"] == 6.40

    # Verify timeline series points
    obs_points = [p for p in resp.series if p.kind == "observed"]
    fc_points = [p for p in resp.series if p.kind == "forecast"]
    assert len(obs_points) == 18
    assert len(fc_points) == 24


def test_backend_lstm_forecasting_horizons():
    state = HospitalState(arrival_rate=28.0, hour_of_day=14, day_of_week=3, month=6)
    res_24h = deep_learning_service.forecast_arrivals(state, horizon="24h")
    res_7d = deep_learning_service.forecast_arrivals(state, horizon="7d")
    res_30d = deep_learning_service.forecast_arrivals(state, horizon="30d")

    assert res_24h.horizon == "24h"
    assert res_7d.horizon == "7d"
    assert res_30d.horizon == "30d"

    # Series should have distinct lengths
    assert len(res_24h.series) == 42
    assert len(res_7d.series) == 14
    assert len(res_30d.series) == 60

    # Values should be dynamic and distinct
    assert res_24h.predicted_peak_rate != res_7d.predicted_peak_rate
    assert res_7d.predicted_peak_rate > 100  # Daily total


def test_backend_lstm_forecasting_is_deterministic():
    state = HospitalState(arrival_rate=30.0, hour_of_day=16, day_of_week=4, month=7)
    resp1 = deep_learning_service.forecast_arrivals(state, horizon="24h")
    resp2 = deep_learning_service.forecast_arrivals(state, horizon="24h")

    # Verify zero randomness
    assert resp1.horizons == resp2.horizons
    assert [p.value for p in resp1.series] == [p.value for p in resp2.series]
