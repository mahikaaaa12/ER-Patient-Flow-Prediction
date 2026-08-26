"""
Comprehensive Automated Test Suite for ERFlow FastAPI ML Backend.
Tests:
1. Health Endpoint (/api/health)
2. Supervised Models (XGBoost Regressor & Classifier, Preprocessor, Label Encoder)
   - Valid input prediction
   - Individual model routes (/predict/waiting-time, /predict/crowding-risk)
   - Invalid/missing input validation error handling (422)
3. Unsupervised Models (K-Means, DBSCAN, Scaler, PCA)
   - Valid input prediction (/predict/unsupervised, /patterns/flow, /surge/detect)
   - Clustering, PCA coordinates, surge anomaly output verification
   - Invalid input validation error handling (422)
4. Deep Learning Model (LSTM .keras, Feature Scaler, Target Scaler, Config)
   - Valid input prediction (/predict/deep-learning, /forecast/arrivals)
   - Sequence generation and target inverse scaling verification
   - Invalid sequence/input error handling (422)
5. Aggregated Overview (/dashboard/overview) & AI Assistant (/ai-assistant/query)
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

# Ensure root workspace directory is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.main import app
from backend.services.artifact_loader import artifact_loader


class TestERFlowBackendInference(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Ensure all artifacts are loaded
        artifact_loader.load_all()

    def setUp(self):
        self.valid_state = {
            "hour_of_day": 18,
            "day_of_week": 4,
            "is_weekend": 0,
            "month": 7,
            "season": "Summer",
            "time_period": "Evening",
            "arrival_rate": 28.0,
            "available_beds": 8.0,
            "available_doctors": 5.0,
            "available_nurses": 9.0,
            "patients_waiting": 24.0,
            "severity_level": 3.0,
            "occupancy_percent": 78.0
        }

    # -------------------------------------------------------------------------
    # 1. Health Endpoint
    # -------------------------------------------------------------------------
    def test_01_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["artifacts_loaded"])

        models = data["models"]
        # Supervised check
        self.assertTrue(models["supervised"]["xgboost_regressor"])
        self.assertTrue(models["supervised"]["xgboost_classifier"])
        self.assertTrue(models["supervised"]["preprocessor"])
        self.assertTrue(models["supervised"]["label_encoder"])

        # Unsupervised check
        self.assertTrue(models["unsupervised"]["kmeans_clusterer"])
        self.assertTrue(models["unsupervised"]["scaler"])
        self.assertTrue(models["unsupervised"]["pca_projector"])
        self.assertTrue(models["unsupervised"]["cluster_profiles_loaded"])
        self.assertTrue(models["unsupervised"]["dbscan_params_loaded"])

        # Deep Learning check
        self.assertTrue(models["deep_learning"]["lstm_keras_model"])
        self.assertTrue(models["deep_learning"]["feature_scaler"])
        self.assertTrue(models["deep_learning"]["target_scaler"])
        self.assertTrue(models["deep_learning"]["config_loaded"])

    # -------------------------------------------------------------------------
    # 2. Supervised Learning
    # -------------------------------------------------------------------------
    def test_02_supervised_loading_and_artifacts(self):
        self.assertIsNotNone(artifact_loader.xgb_regressor)
        self.assertIsNotNone(artifact_loader.xgb_classifier)
        self.assertIsNotNone(artifact_loader.supervised_preprocessor)
        self.assertIsNotNone(artifact_loader.label_encoder)

    def test_03_supervised_predict_valid(self):
        response = self.client.post("/api/predict/supervised", json=self.valid_state)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("waiting_time", data)
        self.assertIn("crowding_risk", data)

        # Regressor output verification
        wt = data["waiting_time"]
        self.assertGreater(wt["waiting_time_minutes"], 0)
        self.assertGreater(wt["predicted_1h"], 0)
        self.assertGreater(wt["predicted_peak"], 0)
        self.assertIn(wt["trend"], ["Increasing", "Decreasing", "Stable"])
        self.assertEqual(wt["model_name"], "XGBoost Regressor")

        # Classifier output verification
        cr = data["crowding_risk"]
        self.assertIn(cr["crowding_level"], ["LOW", "MODERATE", "HIGH", "CRITICAL"])
        self.assertGreaterEqual(cr["crowding_score"], 0)
        self.assertLessEqual(cr["crowding_score"], 100)
        self.assertIn("probabilities", cr)
        self.assertEqual(cr["model_name"], "XGBoost Classifier")

    def test_04_supervised_individual_routes(self):
        # Waiting time endpoint
        res_wt = self.client.post("/api/predict/waiting-time", json=self.valid_state)
        self.assertEqual(res_wt.status_code, 200)
        self.assertIn("waiting_time_minutes", res_wt.json())

        # Crowding risk endpoint
        res_cr = self.client.post("/api/predict/crowding-risk", json=self.valid_state)
        self.assertEqual(res_cr.status_code, 200)
        self.assertIn("crowding_level", res_cr.json())

    def test_05_supervised_invalid_input_handling(self):
        # Invalid hour_of_day (99) -> Pydantic validation error (422)
        invalid_state = self.valid_state.copy()
        invalid_state["hour_of_day"] = 99
        response = self.client.post("/api/predict/supervised", json=invalid_state)
        self.assertEqual(response.status_code, 422)

        # Invalid data type for occupancy_percent
        invalid_type_state = self.valid_state.copy()
        invalid_type_state["occupancy_percent"] = "not_a_number"
        response_type = self.client.post("/api/predict/supervised", json=invalid_type_state)
        self.assertEqual(response_type.status_code, 422)

    # -------------------------------------------------------------------------
    # 3. Unsupervised Learning
    # -------------------------------------------------------------------------
    def test_06_unsupervised_loading_and_artifacts(self):
        self.assertIsNotNone(artifact_loader.kmeans_model)
        self.assertIsNotNone(artifact_loader.unsupervised_scaler)
        self.assertIsNotNone(artifact_loader.pca_model)
        self.assertGreater(len(artifact_loader.cluster_profiles), 0)
        self.assertGreater(len(artifact_loader.dbscan_params), 0)

    def test_07_unsupervised_predict_valid(self):
        response = self.client.post("/api/predict/unsupervised", json=self.valid_state)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("flow_pattern", data)
        self.assertIn("surge_detection", data)

        # Flow pattern output verification
        fp = data["flow_pattern"]
        self.assertIn(fp["pattern_name"], ["High Demand", "Medium Demand", "Low Demand", "Standard Demand"])
        self.assertGreaterEqual(fp["confidence"], 0)
        self.assertLessEqual(fp["confidence"], 100)
        self.assertIn("current_point", fp)
        self.assertIn("x", fp["current_point"])
        self.assertIn("y", fp["current_point"])
        self.assertEqual(fp["model_name"], "K-Means Clustering")

        # Surge detection output verification
        sd = data["surge_detection"]
        self.assertIsInstance(sd["is_surge"], bool)
        self.assertIn("status", sd)
        self.assertIn(sd["severity"], ["Low", "Moderate", "High"])
        self.assertEqual(sd["model_name"], "DBSCAN Anomaly Detector")

    def test_08_unsupervised_individual_routes(self):
        # Flow patterns route
        res_fp = self.client.post("/api/patterns/flow", json=self.valid_state)
        self.assertEqual(res_fp.status_code, 200)
        self.assertIn("pattern_name", res_fp.json())

        # Surge detect route
        res_sd = self.client.post("/api/surge/detect", json=self.valid_state)
        self.assertEqual(res_sd.status_code, 200)
        self.assertIn("is_surge", res_sd.json())

    def test_09_unsupervised_invalid_input_handling(self):
        # Severity level out of bounds (>5)
        invalid_state = self.valid_state.copy()
        invalid_state["severity_level"] = 10.0
        response = self.client.post("/api/predict/unsupervised", json=invalid_state)
        self.assertEqual(response.status_code, 422)

    # -------------------------------------------------------------------------
    # 4. Deep Learning (LSTM)
    # -------------------------------------------------------------------------
    def test_10_deep_learning_loading_and_artifacts(self):
        self.assertIsNotNone(artifact_loader.lstm_model)
        self.assertIsNotNone(artifact_loader.lstm_feature_scaler)
        self.assertIsNotNone(artifact_loader.lstm_target_scaler)
        self.assertGreater(len(artifact_loader.lstm_config), 0)

    def test_11_deep_learning_predict_valid(self):
        response = self.client.post("/api/predict/deep-learning", json=self.valid_state)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("horizons", data)
        horizons = data["horizons"]
        self.assertIn("1h", horizons)
        self.assertIn("3h", horizons)
        self.assertIn("6h", horizons)
        self.assertIn("24h", horizons)

        # Check cumulative monotonicity (1h <= 3h <= 6h <= 24h)
        self.assertLessEqual(horizons["1h"], horizons["3h"])
        self.assertLessEqual(horizons["3h"], horizons["6h"])
        self.assertLessEqual(horizons["6h"], horizons["24h"])

        # Check forecast cards
        self.assertEqual(len(data["forecast_cards"]), 4)

        # Check timeline series
        self.assertGreater(len(data["series"]), 0)
        self.assertEqual(data["model_name"], "LSTM Neural Network")

    def test_12_deep_learning_custom_history_sequence(self):
        state_with_history = self.valid_state.copy()
        # Provide 168 custom past arrival rates
        state_with_history["recent_arrival_history"] = [15.0 + (i % 10) for i in range(168)]

        response = self.client.post("/api/forecast/arrivals", json=state_with_history)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("horizons", data)
        self.assertGreater(data["horizons"]["1h"], 0)

    def test_13_deep_learning_invalid_input_handling(self):
        invalid_state = self.valid_state.copy()
        invalid_state["month"] = 14  # Invalid month
        response = self.client.post("/api/predict/deep-learning", json=invalid_state)
        self.assertEqual(response.status_code, 422)

    # -------------------------------------------------------------------------
    # 5. Aggregated Overview & AI Assistant
    # -------------------------------------------------------------------------
    def test_14_dashboard_overview(self):
        # GET overview
        res_get = self.client.get("/api/dashboard/overview")
        self.assertEqual(res_get.status_code, 200)
        data_get = res_get.json()
        self.assertIn("ai_summary_text", data_get)
        self.assertIn("forecast", data_get)
        self.assertIn("waiting_time", data_get)
        self.assertIn("crowding_risk", data_get)
        self.assertIn("flow_pattern", data_get)
        self.assertIn("surge_detection", data_get)

        # POST overview with custom state
        res_post = self.client.post("/api/dashboard/overview", json=self.valid_state)
        self.assertEqual(res_post.status_code, 200)

    def test_15_ai_assistant_query(self):
        query_body = {
            "question": "When will the ER be busiest today?",
            "hospital_state": self.valid_state
        }
        response = self.client.post("/api/ai-assistant/query", json=query_body)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("text", data)
        self.assertGreater(len(data["text"]), 0)
        self.assertIn("insights", data)
        self.assertGreater(len(data["insights"]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
