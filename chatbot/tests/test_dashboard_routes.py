from fastapi.testclient import TestClient
from main import app


def test_api_health_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["ml_model_available"] is True
        assert data["artifacts_loaded"] is True
        assert "models" in data
        assert data["models"]["supervised"]["waiting_time_model"] is True
        assert data["models"]["supervised"]["crowding_model"] is True
        assert data["models"]["unsupervised"]["flow_pattern_model"] is True
        assert data["models"]["unsupervised"]["high_demand_model"] is True
        assert data["models"]["deep_learning"]["patient_volume_model"] is True


def test_dashboard_overview_get_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/dashboard/overview")
        assert res.status_code == 200
        data = res.json()
        assert "forecast" in data
        assert "waiting_time" in data
        assert "crowding_risk" in data
        assert "flow_pattern" in data
        assert "surge_detection" in data
        assert "ai_summary_text" in data

        assert "horizons" in data["forecast"]
        assert "waiting_time_minutes" in data["waiting_time"]
        assert "crowding_level" in data["crowding_risk"]
        assert "pattern_name" in data["flow_pattern"]
        assert "status" in data["surge_detection"]


def test_dashboard_overview_post_endpoint():
    with TestClient(app) as client:
        res = client.post("/api/dashboard/overview", json={"occupancy_percent": 85, "patients_waiting": 30})
        assert res.status_code == 200
        data = res.json()
        assert "forecast" in data
        assert "waiting_time" in data
        assert "crowding_risk" in data


def test_individual_pillar_endpoints():
    with TestClient(app) as client:
        dl_res = client.post("/api/predict/deep-learning", json={})
        assert dl_res.status_code == 200

        wt_res = client.post("/api/predict/waiting-time", json={})
        assert wt_res.status_code == 200

        cr_res = client.post("/api/predict/crowding-risk", json={})
        assert cr_res.status_code == 200

        fl_res = client.post("/api/patterns/flow", json={})
        assert fl_res.status_code == 200

        sg_res = client.post("/api/surge/detect", json={})
        assert sg_res.status_code == 200
