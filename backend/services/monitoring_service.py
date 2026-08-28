import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

REFERENCE_DISTRIBUTIONS = {
    "arrival_rate": {"mean": 25.0, "std": 10.0},
    "occupancy_percent": {"mean": 70.0, "std": 15.0},
    "patients_waiting": {"mean": 20.0, "std": 12.0},
}

EXPECTED_MODELS = [
    "waiting_time_model",
    "crowding_model",
    "high_demand_model",
    "flow_pattern_model",
    "patient_volume_model",
]


class MLMonitoringService:
    """
    Lightweight telemetry & operational health monitoring service for backend ML models.
    """

    def __init__(self) -> None:
        self._metrics: Dict[str, Dict[str, Any]] = {}
        self._recent_inputs: Dict[str, List[Dict[str, float]]] = {}
        self._reset_all()

    def _reset_all(self) -> None:
        for model_key in EXPECTED_MODELS:
            self._metrics[model_key] = {
                "model_key": model_key,
                "model_name": self._get_default_model_name(model_key),
                "version": "1.0.0",
                "status": "online",
                "inference_count": 0,
                "error_count": 0,
                "validation_failures": 0,
                "last_inference_timestamp": None,
                "last_latency_ms": None,
                "avg_latency_ms": 0.0,
                "min_latency_ms": None,
                "max_latency_ms": None,
                "latest_prediction": None,
                "total_latency_ms": 0.0,
            }
            self._recent_inputs[model_key] = []

    def _get_default_model_name(self, model_key: str) -> str:
        names = {
            "waiting_time_model": "Supervised XGBoost Regressor",
            "crowding_model": "Supervised XGBoost Classifier",
            "high_demand_model": "Operational Surge Anomaly Detector",
            "flow_pattern_model": "Unsupervised K-Means + PCA",
            "patient_volume_model": "Deep Learning LSTM",
        }
        return names.get(model_key, model_key)

    def record_inference_start(self, model_key: str) -> float:
        return time.perf_counter()

    def record_inference_success(
        self,
        model_key: str,
        start_time: float,
        prediction: Any = None,
        input_features: Optional[Dict[str, Any]] = None,
    ) -> float:
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        m = self._metrics.setdefault(model_key, self._init_model_metric(model_key))

        m["inference_count"] += 1
        m["last_latency_ms"] = round(latency_ms, 2)
        m["total_latency_ms"] += latency_ms
        m["avg_latency_ms"] = round(m["total_latency_ms"] / m["inference_count"], 2)
        m["last_inference_timestamp"] = datetime.now(timezone.utc).isoformat()
        m["status"] = "online"

        if m["min_latency_ms"] is None or latency_ms < m["min_latency_ms"]:
            m["min_latency_ms"] = round(latency_ms, 2)
        if m["max_latency_ms"] is None or latency_ms > m["max_latency_ms"]:
            m["max_latency_ms"] = round(latency_ms, 2)

        if prediction is not None:
            m["latest_prediction"] = prediction

        if input_features and isinstance(input_features, dict):
            buf = self._recent_inputs.setdefault(model_key, [])
            buf.append({k: float(v) for k, v in input_features.items() if isinstance(v, (int, float, np.number))})
            if len(buf) > 50:
                buf.pop(0)

        return latency_ms

    def record_inference_error(self, model_key: str, error_msg: str) -> None:
        m = self._metrics.setdefault(model_key, self._init_model_metric(model_key))
        m["error_count"] += 1
        m["status"] = "degraded" if m["inference_count"] > 0 else "offline"
        m["last_error"] = error_msg
        logger.error(f"Inference error recorded for '{model_key}': {error_msg}")

    def record_validation_failure(self, model_key: str) -> None:
        m = self._metrics.setdefault(model_key, self._init_model_metric(model_key))
        m["validation_failures"] += 1

    def set_model_offline(self, model_key: str, reason: str = "Artifact missing") -> None:
        m = self._metrics.setdefault(model_key, self._init_model_metric(model_key))
        m["status"] = "offline"
        m["last_error"] = reason

    def check_input_drift(self, model_key: str) -> Dict[str, Any]:
        buf = self._recent_inputs.get(model_key, [])
        if len(buf) < 5:
            return {
                "drift_status": "Monitoring baseline unavailable",
                "message": "Insufficient inference history (<5 samples) to establish baseline comparison.",
                "has_drift": False,
            }

        z_scores = []
        for feat, ref in REFERENCE_DISTRIBUTIONS.items():
            vals = [sample[feat] for sample in buf if feat in sample]
            if vals:
                sample_mean = np.mean(vals)
                z = abs(sample_mean - ref["mean"]) / ref["std"]
                z_scores.append(z)

        if not z_scores:
            return {
                "drift_status": "Monitoring baseline unavailable",
                "message": "Required reference features absent from input payload.",
                "has_drift": False,
            }

        max_z = float(np.max(z_scores))
        if max_z > 3.0:
            return {
                "drift_status": "Drift Detected",
                "message": f"Input feature distribution shifted by {max_z:.2f} SDs from training baseline.",
                "has_drift": True,
                "max_z_score": round(max_z, 2),
            }
        return {
            "drift_status": "Normal",
            "message": f"Input feature values within baseline bounds (max Z-score: {max_z:.2f}).",
            "has_drift": False,
            "max_z_score": round(max_z, 2),
        }

    def get_monitoring_report(self) -> Dict[str, Any]:
        report = {}
        for model_key in EXPECTED_MODELS:
            m = dict(self._metrics.get(model_key, self._init_model_metric(model_key)))
            m["drift_info"] = self.check_input_drift(model_key)
            report[model_key] = m
        return report

    def get_system_alerts(self) -> List[Dict[str, Any]]:
        alerts = []
        for model_key, m in self._metrics.items():
            name = m["model_name"]
            if m["status"] == "offline":
                alerts.append({
                    "severity": "critical",
                    "model": name,
                    "type": "model_unavailable",
                    "message": f"{name} is currently OFFLINE or un-registered.",
                })
            if m["error_count"] >= 3:
                alerts.append({
                    "severity": "warning",
                    "model": name,
                    "type": "repeated_failures",
                    "message": f"{name} has logged {m['error_count']} inference failures.",
                })
            if m["last_latency_ms"] and m["last_latency_ms"] > 500:
                alerts.append({
                    "severity": "warning",
                    "model": name,
                    "type": "high_latency",
                    "message": f"{name} experienced elevated inference latency ({m['last_latency_ms']} ms).",
                })
            if m["validation_failures"] >= 5:
                alerts.append({
                    "severity": "info",
                    "model": name,
                    "type": "invalid_input_rate",
                    "message": f"{name} has intercepted {m['validation_failures']} invalid input payloads.",
                })

            drift = self.check_input_drift(model_key)
            if drift.get("has_drift"):
                alerts.append({
                    "severity": "warning",
                    "model": name,
                    "type": "input_drift",
                    "message": f"{name}: {drift['message']}",
                })
        return alerts

    def _init_model_metric(self, model_key: str) -> Dict[str, Any]:
        return {
            "model_key": model_key,
            "model_name": self._get_default_model_name(model_key),
            "version": "1.0.0",
            "status": "online",
            "inference_count": 0,
            "error_count": 0,
            "validation_failures": 0,
            "last_inference_timestamp": None,
            "last_latency_ms": None,
            "avg_latency_ms": 0.0,
            "min_latency_ms": None,
            "max_latency_ms": None,
            "latest_prediction": None,
            "total_latency_ms": 0.0,
        }


monitoring_service = MLMonitoringService()
