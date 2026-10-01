"""Integration test suite for the RevOps Pro backend API.

Run:
    cd backend && python -m pytest test_api.py -v

IMPORTANT - test database isolation
------------------------------------
``DATABASE_URL`` is redirected to a throwaway SQLite file *before* any app
module is imported.  ``app.core.config.settings`` and the SQLAlchemy engine are
both built at import time, so the override has to happen first; setting it later
would silently keep using the development database and let tests write junk rows
into real data.  The temp file is removed on teardown.
"""
from __future__ import annotations

import os
import sys
import tempfile

# Ensure backend/ is on sys.path regardless of where pytest is invoked from.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# --------------------------------------------------------------------------- 
# Isolate the database BEFORE importing app.main / app.core.config.
# ---------------------------------------------------------------------------
_TEST_DB_DIR = tempfile.mkdtemp(prefix="revops-tests-")
_TEST_DB_PATH = os.path.join(_TEST_DB_DIR, "test_revops.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH}"
os.environ["SCHEDULER_ENABLED"] = "0"
# Neutralise any real AI gateway credentials so tests never hit a live provider.
os.environ.setdefault("OMNIROUTE_API_KEY", "")

import atexit
import shutil

import pytest
from fastapi.testclient import TestClient

import app.main as _main_mod
from app.main import app


@atexit.register
def _cleanup_test_db() -> None:
    shutil.rmtree(_TEST_DB_DIR, ignore_errors=True)


# `TestClient(app)` does not run the ASGI lifespan unless it is used as a context
# manager, so init_db() has to be called explicitly to create the schema in the
# throwaway database.
from app.database.connection import init_db as _init_db  # noqa: E402

_init_db()


client = TestClient(app)


class TestDatabaseIsolation:
    """Guard rails proving the suite does not touch the development database."""

    def test_uses_temporary_database(self):
        from app.core.config import settings
        from app.database.connection import engine

        url = str(engine.url)
        assert url.startswith("sqlite:///"), f"expected sqlite, got {url}"
        assert "test_revops.db" in url, f"tests must not use {url}"
        assert "revops-tests-" in url, f"tests must use a temp dir, got {url}"
        # The development database must not be the active one.
        assert not url.endswith("/data/revops.db"), "tests are pointed at the dev DB!"

    def test_dev_database_untouched(self):
        """The dev DB file must never be opened for writing by the test run."""
        from app.core.config import settings
        from app.database.connection import engine

        dev_path = os.path.join(
            _BACKEND_DIR, "data", "revops.db",
        )
        assert str(engine.url) != f"sqlite:///{dev_path}"


class TestRoot:
    def test_root_returns_info(self):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "RevOps Pro"
        assert data["version"] == "1.0.0"
        assert data["status"] == "running"


class TestHealth:
    def test_health_returns_healthy(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"


class TestAuthAnonymous:
    def test_login_bad_credentials(self):
        resp = client.post("/api/auth/login", data={
            "username": "admin@revops.pro", "password": "wrong",
        })
        assert resp.status_code == 401

    def test_me_without_token(self):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


class TestProtectedRoutes:
    def test_leads_401(self):
        resp = client.get("/api/leads")
        assert resp.status_code == 401

    def test_deals_401(self):
        resp = client.get("/api/deals")
        assert resp.status_code == 401

    def test_ml_predict_401(self):
        resp = client.post("/api/predict/lead-score", json={
            "name": "Test", "company": "Test Co", "value": 50000,
            "source": "Website", "touchpoints": 3, "industry": "Technology",
            "company_size": "Mid-Market",
        })
        assert resp.status_code == 401


class TestAPIRegistration:
    """Verify all routes are registered."""

    def test_crm_routes(self):
        for p in ["/api/leads", "/api/deals", "/api/accounts", "/api/activities"]:
            resp = client.get(p)
            assert resp.status_code in (401, 200), f"{p} should be registered"

    def test_ml_routes(self):
        # POST routes
        for p in ["/api/predict/lead-score", "/api/predict/revenue-forecast"]:
            resp = client.post(p, json={})
            assert resp.status_code in (401, 200, 500), f"{p} should be registered"
        # GET routes
        for p in ["/api/predict/pipeline-insights", "/api/predict/churn-risk",
                   "/api/predict/anomalies", "/api/predict/next-best-actions"]:
            resp = client.get(p)
            assert resp.status_code in (401, 200, 500), f"{p} should be registered"

    def test_admin_routes(self):
        for p in ["/api/admin/stats", "/api/admin/models", "/api/admin/activity"]:
            resp = client.get(p)
            assert resp.status_code in (401, 403, 200), f"{p} should be registered"

    def test_alerts_routes(self):
        resp = client.get("/api/alerts")
        assert resp.status_code == 401

    def test_analytics_routes(self):
        for p in ["/api/analytics/funnel", "/api/analytics/cohorts",
                   "/api/analytics/trends", "/api/analytics/exec-summary"]:
            resp = client.get(p)
            assert resp.status_code in (401, 200), f"{p} should be registered"

    def test_copilot_route(self):
        resp = client.post("/api/copilot/ask", json={"question": "hello"})
        assert resp.status_code in (401, 200)


class TestRegistrationSecurity:
    """Public registration must never be able to grant a privileged role."""

    def _register(self, email, role):
        return client.post("/api/auth/register", json={
            "name": "Escalation Attempt",
            "email": email,
            "password": "Sup3rSecret!23",
            "role": role,
        })

    def test_register_with_admin_role_is_downgraded(self):
        resp = self._register("esc-admin@revops.pro", "admin")
        assert resp.status_code == 200, resp.text
        assert resp.json()["role"] == "sales-executive", (
            "privilege escalation: public registration granted admin!"
        )

    def test_register_with_manager_role_is_downgraded(self):
        resp = self._register("esc-manager@revops.pro", "manager")
        assert resp.status_code == 200, resp.text
        assert resp.json()["role"] == "sales-executive"

    def test_register_with_unknown_role_rejected(self):
        resp = self._register("esc-bogus@revops.pro", "superuser")
        assert resp.status_code == 400

    def test_downgraded_user_cannot_reach_admin_routes(self):
        self._register("esc-blocked@revops.pro", "admin")
        login = client.post("/api/auth/login", data={
            "username": "esc-blocked@revops.pro", "password": "Sup3rSecret!23",
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        assert login.json()["user"]["role"] == "sales-executive"

        admin_resp = client.get(
            "/api/admin/stats", headers={"Authorization": f"Bearer {token}"},
        )
        assert admin_resp.status_code == 403, (
            f"self-registered user reached admin route: {admin_resp.status_code}"
        )

    def test_duplicate_email_conflicts(self):
        self._register("esc-dup@revops.pro", "sales-executive")
        resp = self._register("esc-dup@revops.pro", "sales-executive")
        assert resp.status_code == 409


class TestEventsSecurity:
    """The SSE stream must not be an unauthenticated data leak."""

    def test_sse_requires_token(self):
        resp = client.get("/api/events/stream")
        assert resp.status_code == 401, "SSE stream is public!"

    def test_sse_rejects_invalid_token(self):
        resp = client.get("/api/events/stream", params={"token": "not-a-real-jwt"})
        assert resp.status_code == 401

    def test_sse_rejects_empty_token(self):
        resp = client.get("/api/events/stream", params={"token": ""})
        assert resp.status_code == 401


class TestOmniRouteURL:
    """Regression tests for the /v1/v1/chat/completions double-segment bug."""

    def test_base_url_with_v1_segment_is_not_doubled(self):
        from app.ai.omniroute import OmniRouteClient

        client = OmniRouteClient(base_url="http://localhost:20128/v1", api_key="k")
        assert client.chat_url == "http://localhost:20128/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_base_url_without_v1_segment_gets_one(self):
        from app.ai.omniroute import OmniRouteClient

        client = OmniRouteClient(base_url="http://localhost:20128", api_key="k")
        assert client.chat_url == "http://localhost:20128/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_trailing_slash_is_tolerated(self):
        from app.ai.omniroute import OmniRouteClient

        client = OmniRouteClient(base_url="http://localhost:20128/v1/", api_key="k")
        assert client.chat_url == "http://localhost:20128/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_real_configured_url_is_well_formed(self):
        from app.ai.omniroute import omniroute_client

        url = omniroute_client.chat_url
        assert "/v1/v1/" not in url, f"doubled version segment: {url}"
        assert url.endswith("/chat/completions")


class TestCopilotHonesty:
    """The Copilot must always disclose which engine actually answered."""

    def _login_admin(self):
        from app.services import data_store as _ds

        # The isolated test DB starts empty, so create the admin this test needs.
        admin = _ds.get_user("admin@revops.pro")
        if not admin:
            admin = _ds.create_user({
                "name": "Test Admin",
                "email": "admin@revops.pro",
                "password": "TestOnly123!",
                "role": "admin",
            })
        from app.core.security import create_access_token

        return create_access_token({"sub": admin["email"], "role": admin["role"]})

    def test_response_declares_provider_model_and_note(self):
        token = self._login_admin()
        resp = client.post(
            "/api/copilot/ask",
            json={"question": "How is the pipeline doing?"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        # These keys must always be present in the response contract.
        assert "provider" in body
        assert "model" in body
        assert "note" in body
        assert body["provider"] in ("omniroute", "local-rules")

        if body["provider"] == "local-rules":
            # Never let a deterministic answer masquerade as AI output.
            assert body["model"] is None, "rule fallback must not claim a model"
            assert body["note"], "rule fallback must explain itself"

    def test_missing_credentials_are_reported(self):
        from app.ai.copilot import RuleCopilot
        from app.ai.omniroute import OmniRouteClient

        copilot = RuleCopilot(OmniRouteClient(api_key=""))
        result = copilot.ask("What is our revenue?")
        assert result["provider"] == "local-rules"
        assert result["model"] is None
        assert "credentials" in result["note"].lower()


class TestModels:
    def test_lead_scoring_model(self):
        from app.ml.artifacts.lead_scoring_model import LeadScoringModel
        model = LeadScoringModel()
        result = model.predict({
            "name": "Test", "company": "Test Co", "value": 50000,
            "source": "Website", "touchpoints": 3, "industry": "Technology",
            "company_size": "Mid-Market",
        })
        assert "score" in result
        assert "label" in result
        assert result["label"] in ("Hot", "Warm", "Cool", "Cold")

    def test_revenue_forecast_model(self):
        from app.ml.inference.revenue_forecast_model import RevenueForecastModel
        model = RevenueForecastModel()
        result = model.forecast(timeframe="monthly", model_type="ridge")
        assert "data" in result

    def test_pipeline_insights_engine(self):
        from app.ml.inference.insights_engine import PipelineInsightsEngine
        engine = PipelineInsightsEngine()
        result = engine.generate_insights()
        assert "pipeline_health_score" in result
        assert "insights" in result


class TestDocs:
    def test_openapi_schema(self):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200