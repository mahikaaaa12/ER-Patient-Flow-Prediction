import pytest
import time
from app.ml_service.monitoring_service import MLMonitoringService, monitoring_service


def test_monitoring_service_inference_recording():
    service = MLMonitoringService()

    # 1. Record inference start and success
    t0 = service.record_inference_start("waiting_time_model")
    time.sleep(0.01)  # 10 ms sleep
    latency = service.record_inference_success(
        model_key="waiting_time_model",
        start_time=t0,
        prediction={"estimated_wait_minutes": 43.5},
        input_features={"arrival_rate": 28.0, "occupancy_percent": 78.0, "patients_waiting": 25},
    )

    assert latency >= 5.0  # Latency recorded in ms
    report = service.get_monitoring_report()
    wt_metrics = report["waiting_time_model"]

    assert wt_metrics["inference_count"] == 1
    assert wt_metrics["error_count"] == 0
    assert wt_metrics["status"] == "online"
    assert wt_metrics["last_latency_ms"] == round(latency, 2)
    assert wt_metrics["latest_prediction"] == {"estimated_wait_minutes": 43.5}


def test_monitoring_service_error_and_offline():
    service = MLMonitoringService()

    service.record_inference_error("crowding_model", "Model matrix execution failed")
    report = service.get_monitoring_report()
    cr_metrics = report["crowding_model"]

    assert cr_metrics["error_count"] == 1
    assert cr_metrics["status"] == "offline"

    service.set_model_offline("patient_volume_model", "Keras artifact un-registered")
    pv_metrics = service.get_monitoring_report()["patient_volume_model"]
    assert pv_metrics["status"] == "offline"


def test_monitoring_service_validation_failure():
    service = MLMonitoringService()
    service.record_validation_failure("high_demand_model")
    m = service.get_monitoring_report()["high_demand_model"]
    assert m["validation_failures"] == 1


def test_monitoring_service_drift_detection():
    service = MLMonitoringService()

    # Insufficient samples check (<5 samples)
    drift1 = service.check_input_drift("waiting_time_model")
    assert drift1["drift_status"] == "Monitoring baseline unavailable"
    assert drift1["has_drift"] is False

    # Record 5 normal samples
    for _ in range(5):
        t0 = service.record_inference_start("waiting_time_model")
        service.record_inference_success(
            "waiting_time_model",
            t0,
            prediction={"estimated_wait_minutes": 43.0},
            input_features={"arrival_rate": 25.0, "occupancy_percent": 70.0, "patients_waiting": 20},
        )

    drift2 = service.check_input_drift("waiting_time_model")
    assert drift2["drift_status"] == "Normal"
    assert drift2["has_drift"] is False

    # Record 10 extreme drifted samples (arrival_rate = 120.0, >9 SD shift)
    for _ in range(10):
        t0 = service.record_inference_start("waiting_time_model")
        service.record_inference_success(
            "waiting_time_model",
            t0,
            prediction={"estimated_wait_minutes": 99.0},
            input_features={"arrival_rate": 120.0, "occupancy_percent": 100.0, "patients_waiting": 150},
        )

    drift3 = service.check_input_drift("waiting_time_model")
    assert drift3["drift_status"] == "Drift Detected"
    assert drift3["has_drift"] is True


def test_monitoring_service_alerts_generation():
    service = MLMonitoringService()

    service.set_model_offline("flow_pattern_model", "K-Means artifact missing")
    alerts = service.get_system_alerts()

    assert len(alerts) > 0
    assert any(a["model"] == "Unsupervised K-Means + PCA" and a["type"] == "model_unavailable" for a in alerts)
