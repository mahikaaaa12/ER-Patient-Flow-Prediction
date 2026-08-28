import pytest
import numpy as np
from backend.schemas.hospital_state import HospitalState
from backend.services.deep_learning_service import deep_learning_service


def test_backend_lstm_forecasting_uses_real_data():
    state = HospitalState(arrival_rate=28.0, hour_of_day=14, day_of_week=3, month=6)
    resp = deep_learning_service.forecast_arrivals(state)

    assert "LSTM" in resp.model_name
    assert "REAL HISTORICAL DATA" in resp.data_source
    assert resp.validation_metrics is not None
    assert resp.validation_metrics["1h_mae"] == 3.39
    assert resp.validation_metrics["3h_mae"] == 6.40
    assert resp.validation_metrics["6h_mae"] == 10.58
    assert resp.validation_metrics["24h_mae"] == 33.17

    # Verify timeline length and separation
    assert len(resp.series) == 24
    obs_points = [p for p in resp.series if p.kind == "observed"]
    fc_points = [p for p in resp.series if p.kind == "forecast"]
    assert len(obs_points) == 18
    assert len(fc_points) == 6


def test_backend_lstm_forecasting_is_deterministic():
    state = HospitalState(arrival_rate=30.0, hour_of_day=16, day_of_week=4, month=7)
    resp1 = deep_learning_service.forecast_arrivals(state)
    resp2 = deep_learning_service.forecast_arrivals(state)

    # Verify zero randomness
    assert resp1.horizons == resp2.horizons
    assert [p.value for p in resp1.series] == [p.value for p in resp2.series]
