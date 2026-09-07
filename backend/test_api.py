import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db import init_db
from backend.seed_loader import seed_if_empty
import backend.data_store as ds

init_db()
seed_if_empty()

client = TestClient(app)

ADMIN_EMAIL = "admin@revops.pro"
ADMIN_PASSWORD = "adminpass"
MANAGER_EMAIL = "manager@revops.pro"
MANAGER_PASSWORD = "managerpass"


def _get_token(email: str = ADMIN_EMAIL, password: str = ADMIN_PASSWORD) -> str:
    resp = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.json()}"
    return resp.json()["access_token"]


def _auth_header(token: str = None) -> dict:
    t = token or _get_token()
    return {"Authorization": f"Bearer {t}"}


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------
def test_login_success():
    resp = client.post(
        "/api/auth/login",
        data={"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["role"] == "admin"


def test_login_failure():
    resp = client.post(
        "/api/auth/login",
        data={"username": ADMIN_EMAIL, "password": "wrongpassword"},
    )
    assert resp.status_code == 401


def test_me_endpoint():
    resp = client.get("/api/auth/me", headers=_auth_header())
    assert resp.status_code == 200
    assert resp.json()["email"] == ADMIN_EMAIL


def test_me_unauthenticated():
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
def test_health_check():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["models_loaded"] is True


# ---------------------------------------------------------------------------
# ML Predictions (protected)
# ---------------------------------------------------------------------------
def test_lead_scoring():
    payload = {
        "name": "Global Logistics Corp",
        "company": "Global Logistics",
        "value": 75000,
        "source": "Referral",
        "touchpoints": 5,
        "industry": "Technology",
        "company_size": "Enterprise",
    }
    resp = client.post("/api/predict/lead-score", json=payload, headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data
    assert "label" in data
    assert 0 <= data["score"] <= 100
    assert len(data["factors"]) > 0


def test_revenue_forecast():
    payload = {"timeframe": "monthly", "model_type": "random-forest", "periods_ahead": 3}
    resp = client.post("/api/predict/revenue-forecast", json=payload, headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert data["timeframe"] == "monthly"
    assert len(data["data"]) > 0
    assert "ml_projected_total" in data


def test_pipeline_insights():
    resp = client.get("/api/predict/pipeline-insights", headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert "insights" in data
    assert len(data["insights"]) >= 3


def test_generic_predict():
    payload = {"company": "Beta Systems", "value": 35000, "source": "Website"}
    resp = client.post("/api/predict", json=payload, headers=_auth_header())
    assert resp.status_code == 200
    data = resp.json()
    assert "score" in data or "data" in data


def test_predict_requires_auth():
    resp = client.post("/api/predict/lead-score", json={"name": "X", "company": "Y", "value": 1000, "source": "Web"})
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Leads CRUD
# ---------------------------------------------------------------------------
def test_leads_crud():
    h = _auth_header()
    # List
    resp = client.get("/api/leads", headers=h)
    assert resp.status_code == 200
    original_count = len(resp.json())
    # Create
    resp = client.post("/api/leads", json={
        "name": "Test Lead", "company": "Test Co", "value": 50000, "source": "Referral",
    }, headers=h)
    assert resp.status_code == 200
    lead_id = resp.json()["id"]
    assert resp.json()["name"] == "Test Lead"
    # Get
    resp = client.get(f"/api/leads/{lead_id}", headers=h)
    assert resp.status_code == 200
    # Update
    resp = client.put(f"/api/leads/{lead_id}", json={"company": "Updated Co"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["company"] == "Updated Co"
    # Delete
    resp = client.delete(f"/api/leads/{lead_id}", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Deals CRUD
# ---------------------------------------------------------------------------
def test_deals_crud():
    h = _auth_header()
    resp = client.get("/api/deals", headers=h)
    assert resp.status_code == 200
    resp = client.post("/api/deals", json={
        "title": "Test Deal", "company": "Test Co", "value": 100000, "stage": "prospecting",
    }, headers=h)
    assert resp.status_code == 200
    deal_id = resp.json()["id"]
    resp = client.get(f"/api/deals/{deal_id}", headers=h)
    assert resp.status_code == 200
    resp = client.put(f"/api/deals/{deal_id}", json={"stage": "proposal"}, headers=h)
    assert resp.status_code == 200
    assert resp.json()["stage"] == "proposal"
    resp = client.delete(f"/api/deals/{deal_id}", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
def test_activities():
    h = _auth_header()
    resp = client.get("/api/activities", headers=h)
    assert resp.status_code == 200
    resp = client.post("/api/activities", json={
        "deal_id": "d1", "type": "call", "content": "Test activity",
    }, headers=h)
    assert resp.status_code == 200
    assert resp.json()["content"] == "Test activity"
    act_id = resp.json()["id"]
    resp = client.delete(f"/api/activities/{act_id}", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
def test_accounts():
    h = _auth_header()
    resp = client.get("/api/accounts", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 5
    resp = client.get("/api/accounts/c1", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Churn risk
# ---------------------------------------------------------------------------
def test_churn_risk():
    h = _auth_header()
    resp = client.get("/api/predict/churn-risk", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 5
    resp = client.get("/api/predict/churn-risk/c1", headers=h)
    assert resp.status_code == 200
    assert "risk_score" in resp.json()


# ---------------------------------------------------------------------------
# Anomalies
# ---------------------------------------------------------------------------
def test_anomalies():
    h = _auth_header()
    resp = client.get("/api/predict/anomalies", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 5


# ---------------------------------------------------------------------------
# Next best actions
# ---------------------------------------------------------------------------
def test_next_best_actions():
    h = _auth_header()
    resp = client.get("/api/predict/next-best-actions", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 5
    resp = client.get("/api/predict/next-best-actions/d1", headers=h)
    assert resp.status_code == 200
    assert "recommendations" in resp.json()


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
def test_alerts():
    h = _auth_header()
    resp = client.get("/api/alerts", headers=h)
    assert resp.status_code == 200
    resp = client.get("/api/alerts/unread-count", headers=h)
    assert resp.status_code == 200
    assert "count" in resp.json()
    resp = client.post("/api/alerts/regenerate", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
def test_notifications():
    h = _auth_header()
    resp = client.get("/api/notifications", headers=h)
    assert resp.status_code == 200
    resp = client.get("/api/notifications/unread-count", headers=h)
    assert resp.status_code == 200
    resp = client.post("/api/notifications/read-all", headers=h)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
def test_analytics_funnel():
    h = _auth_header()
    resp = client.get("/api/analytics/funnel?by=source", headers=h)
    assert resp.status_code == 200
    assert resp.json()["by"] == "source"
    resp = client.get("/api/analytics/funnel?by=stage", headers=h)
    assert resp.status_code == 200


def test_analytics_cohorts():
    h = _auth_header()
    resp = client.get("/api/analytics/cohorts", headers=h)
    assert resp.status_code == 200
    assert "cohorts" in resp.json()


# ---------------------------------------------------------------------------
# Users admin (admin only)
# ---------------------------------------------------------------------------
def test_users_admin():
    h = _auth_header()
    resp = client.get("/api/users", headers=h)
    assert resp.status_code == 200
    assert len(resp.json()) >= 3
    # Manager should not access this
    h_m = _auth_header(_get_token(MANAGER_EMAIL, MANAGER_PASSWORD))
    resp = client.get("/api/users", headers=h_m)
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------
def test_model_registry():
    h = _auth_header()
    resp = client.get("/api/admin/models", headers=h)
    assert resp.status_code == 200
    assert "lead_scoring" in resp.json()


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------
def test_leads_export():
    h = _auth_header()
    resp = client.get("/api/leads/export", headers=h)
    assert resp.status_code == 200
    assert resp.headers.get("content-type") == "text/csv; charset=utf-8"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
