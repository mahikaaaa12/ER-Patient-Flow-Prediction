import pytest
import time
from backend.services.monitoring_service import MLMonitoringService, monitoring_service


def test_backend_monitoring_service_inference_recording():
    service = MLMonitoringService()

    t0 = service.record_inference_start("waiting_time_model")
    time.sleep(0.005)
    latency = service.record_inference_success(
        model_key="waiting_time_model",
        start_time=t0,
        prediction={"waiting_time_minutes": 50.0},
        input_features={"arrival_rate": 30.0, "occupancy_percent": 80.0},
    )

    assert latency >= 1.0
    report = service.get_monitoring_report()
    assert report["waiting_time_model"]["inference_count"] == 1
    assert report["waiting_time_model"]["status"] == "online"


def test_backend_monitoring_drift_unavailable_when_low_samples():
    service = MLMonitoringService()
    drift = service.check_input_drift("crowding_model")
    assert drift["drift_status"] == "Monitoring baseline unavailable"
