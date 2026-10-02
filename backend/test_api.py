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


# The demo accounts published in README.md.  These are intentionally public —
# they exist so anyone cloning the repo can log in — so the suite asserts they
# stay in sync with the seed data instead of silently drifting.
DEMO_CREDENTIALS = {
    "admin@revops.pro": "adminpass",
    "manager@revops.pro": "managerpass",
    "rep@revops.pro": "reppass",
}


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


class TestAutoSeedOnStartup:
    """A fresh clone must be usable straight after `uvicorn app.main:app`.

    Regression guard: the application rewrite dropped the ``seed_if_empty()``
    call from the startup lifespan, so a brand new database was created with
    tables but *no* users — every documented demo login returned 401.  The
    README promises seeded accounts, so assert the promise holds.
    """

    def test_lifespan_seeds_an_empty_database(self):
        """A brand new database must be populated on startup, idempotently.

        Run in a subprocess so the "empty database" precondition is genuinely
        empty — other tests in this suite create users, so the shared test DB
        cannot be used to model a fresh clone.
        """
        import subprocess
        import textwrap

        fresh_db = os.path.join(
            tempfile.mkdtemp(prefix="revops-fresh-probe-"), "fresh.db",
        )
        # The path is passed via argv (not interpolated into the source) so
        # Windows backslashes can never break the string literal.
        probe = textwrap.dedent(
            f"""
            import os, sys
            sys.path.insert(0, {_BACKEND_DIR!r})
            os.environ["DATABASE_URL"] = "sqlite:///" + sys.argv[1]
            os.environ["SCHEDULER_ENABLED"] = "0"

            from fastapi.testclient import TestClient
            from app.main import app

            # The context manager runs the real startup lifespan, exactly as
            # `uvicorn app.main:app` would.
            with TestClient(app) as c:
                from app.services import data_store as ds
                for email, password in {DEMO_CREDENTIALS!r}.items():
                    assert ds.get_user(email) is not None, f"not seeded: {{email}}"
                    assert ds.verify_user_password(email, password), (
                        f"seeded password for {{email}} does not match the README"
                    )
                r = c.post("/api/auth/login", data={{
                    "username": "admin@revops.pro", "password": "adminpass"}})
                assert r.status_code == 200, f"admin login -> {{r.status_code}}"
                assert r.json()["access_token"]

                # Seeding again must not duplicate anything.
                from scripts.seed_loader import seed_if_empty
                assert seed_if_empty() is False, "second seed should be a no-op"

            print("PROBE_OK")
            """
        )
        proc = subprocess.run(
            [sys.executable, "-c", probe, fresh_db],
            capture_output=True, text=True, timeout=300,
        )
        assert "PROBE_OK" in proc.stdout, (
            f"fresh-startup seeding probe failed\n"
            f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )

    def test_documented_demo_credentials_match_seed_file(self):
        """The passwords published in README.md must match the shipped seed CSV."""
        import csv as _csv

        from app.core.security import verify_password

        seed_path = os.path.join(_BACKEND_DIR, "data", "users.csv")
        assert os.path.exists(seed_path), "users.csv must ship with the repo"

        with open(seed_path, newline="", encoding="utf-8") as fh:
            by_email = {r["email"]: r for r in _csv.DictReader(fh)}

        for email, password in DEMO_CREDENTIALS.items():
            assert email in by_email, f"{email} is missing from the seed file"
            assert verify_password(password, by_email[email]["hashed_password"]), (
                f"README documents {password!r} for {email}, but the seed hash "
                f"does not match — the demo login in the README would fail"
            )

    def test_documented_demo_logins_return_a_token(self):
        """End-to-end: each published account must obtain a JWT.

        Uses its own throwaway database so accounts created by other tests
        (which may reuse these emails with different passwords) cannot make
        this order-dependent.
        """
        import subprocess
        import textwrap

        login_db = os.path.join(
            tempfile.mkdtemp(prefix="revops-demo-login-"), "login.db",
        )
        # Path passed via argv so Windows backslashes stay out of the source.
        probe = textwrap.dedent(
            f"""
            import os, sys
            sys.path.insert(0, {_BACKEND_DIR!r})
            os.environ["DATABASE_URL"] = "sqlite:///" + sys.argv[1]
            os.environ["SCHEDULER_ENABLED"] = "0"

            from fastapi.testclient import TestClient
            from app.main import app

            with TestClient(app) as c:
                for email, password in {DEMO_CREDENTIALS!r}.items():
                    r = c.post("/api/auth/login",
                               data={{"username": email, "password": password}})
                    assert r.status_code == 200, (
                        f"{{email}} login -> {{r.status_code}}: {{r.text}}")
                    body = r.json()
                    assert body.get("access_token"), f"{{email}}: no access_token"
                    assert body["user"]["role"] in (
                        "admin", "manager", "sales-executive")
            print("PROBE_OK")
            """
        )
        proc = subprocess.run(
            [sys.executable, "-c", probe, login_db],
            capture_output=True, text=True, timeout=300,
        )
        assert "PROBE_OK" in proc.stdout, (
            f"demo login probe failed\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )


class TestRuntimeMetrics:
    """T-006: /api/admin/stats must be measured, never hardcoded.

    Previously the middleware and ``record_ml_inference`` existed but were never
    called, so the admin console showed 0 requests / 0 inferences forever while
    real traffic flowed past.
    """

    @staticmethod
    def _admin_token() -> str:
        from app.core.security import create_access_token
        from app.services import data_store as _ds

        admin = _ds.get_user("admin@revops.pro")
        return create_access_token({"sub": admin["email"], "role": admin["role"]})

    def test_requests_are_counted_and_timed(self):
        from app.services import metrics

        metrics.reset()
        # A 200 and a 401 - auth rejections must be counted too.
        assert client.get("/").status_code == 200
        assert client.get("/api/auth/me").status_code == 401

        snap = metrics.snapshot()
        assert snap["requests"] >= 2, "middleware did not record HTTP requests"
        assert snap["request_errors"] == 0, "a 401 is not a server error"

        latency = metrics.latency_summary()
        assert latency["sample_size"] >= 2, "no latency samples recorded"
        assert latency["avg_ms"] >= 0.0
        metrics.reset()

    def test_server_errors_are_counted(self):
        from app.services import metrics

        metrics.reset()
        resp = client.get("/api/users")  # protected -> 401, never a 5xx
        assert resp.status_code == 401
        assert metrics.snapshot()["request_errors"] == 0

        # Simulate the 5xx branch directly: the counter must move for >=500.
        metrics.record_request(12.0, 503)
        assert metrics.snapshot()["request_errors"] == 1
        metrics.reset()

    def test_ml_inference_is_recorded_by_a_real_prediction_call(self):
        from app.services import metrics

        metrics.reset()
        token = self._admin_token()
        resp = client.post(
            "/api/predict/lead-score",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Metrics Probe", "company": "Probe Co",
                "value": 50000, "source": "web", "industry": "tech",
            },
        )
        assert resp.status_code == 200, resp.text

        snap = metrics.snapshot()
        assert snap["ml_inferences"] >= 1, "prediction route did not record an inference"
        assert snap["ml_inference_errors"] == 0
        metrics.reset()

    def test_failed_inference_is_counted_as_an_error(self):
        from app.services import metrics

        metrics.reset()
        metrics.record_ml_inference(success=False)
        snap = metrics.snapshot()
        assert snap["ml_inferences"] == 1
        assert snap["ml_inference_errors"] == 1
        metrics.reset()

    def test_admin_stats_reflect_real_traffic(self):
        """The endpoint must report measured values, not literals."""
        from app.services import metrics

        metrics.reset()
        client.get("/")
        client.get("/api/health")

        token = self._admin_token()
        resp = client.get(
            "/api/admin/stats", headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["requests_total"] >= 1, "admin stats show no measured requests"
        assert body["latency_samples"] >= 1, "admin stats show no latency samples"
        assert body["api_latency_ms"] >= 0.0
        # Derived from the same measured signals, not a hardcoded 99.9.
        assert 0.0 <= body["system_health"] <= 100.0
        metrics.reset()


class TestForecastAccuracyCaching:
    """Regression tests for the shared-slot accuracy cache bug.

    ``accuracy(model_type)`` used to read one R² slot filled by whichever model
    type happened to be evaluated first, so a ridge forecast could report the
    gradient-boosting score (and vice versa).
    """

    @staticmethod
    def _model():
        from app.ml.inference.revenue_forecast_model import RevenueForecastModel
        return RevenueForecastModel()

    @staticmethod
    def _model_with_history():
        """A model pinned to a deterministic monthly series.

        The seeded demo database does not guarantee enough closed-won months to
        produce an R², so these tests supply their own history.  The series has a
        clear trend plus noise, which makes each regressor produce a *different*
        score - that difference is exactly what the shared-slot cache destroyed.
        """
        m = TestForecastAccuracyCaching._model()
        values = [100, 118, 112, 141, 135, 163, 158, 181, 176, 204, 199, 228]
        m.months = [f"20{20 + i // 12}-{i % 12 + 1:02d}" for i in range(len(values))]
        m.values = [float(v) for v in values]
        m._invalidate_cache()
        return m

    def test_accuracy_is_model_specific(self):
        m = self._model_with_history()
        expected = {
            t: m._compute_walk_forward(t)["r2"]
            for t in ("ridge", "linear", "gradient-boosting")
        }
        # Sanity: the three regressors really do score differently.
        assert len(set(expected.values())) == 3, (
            "test history no longer distinguishes the model types")

        m._wf_cache = {}
        # Ask in a different order than the truth was computed - the answer must
        # still belong to the requested model, not the one evaluated first.
        for t in ("gradient-boosting", "linear", "ridge"):
            cached = m.accuracy(t)
            r2 = expected[t]
            assert cached == round(max(0.0, min(100.0, float(r2) * 100)), 1), (
                f"{t}: served a cached score belonging to another model")

    def test_cache_is_keyed_per_model_type(self):
        m = self._model_with_history()
        m._wf_cache = {}
        for t in ("ridge", "linear", "gradient-boosting"):
            m.accuracy(t)
        assert set(m._wf_cache.keys()) == {"ridge", "linear", "gradient-boosting"}

    def test_cache_hit_avoids_recomputation(self):
        m = self._model_with_history()
        m._wf_cache = {}
        m.accuracy("ridge")
        cached_obj = m._wf_cache["ridge"]["metrics"]
        # A cache hit returns the identical object (no recompute).
        assert m._evaluate_walk_forward("ridge") is cached_obj

    def test_stale_cache_is_dropped_when_history_changes(self):
        m = self._model_with_history()
        m._wf_cache = {}
        m.accuracy("ridge")
        stale = m._wf_cache["ridge"]["metrics"]["r2"]
        assert stale is not None

        # A new closed-won month lands: the cached metric no longer describes
        # the data and must be recomputed rather than reused.
        m.months = list(m.months) + ["2099-01"]
        m.values = list(m.values) + [99999.0]
        fresh = m._evaluate_walk_forward("ridge")["r2"]
        assert fresh != stale, "stale cached accuracy was served for new data"

    def test_insufficient_history_reports_zero_not_perfect(self):
        """Too few months to validate must not look like a 100% accurate model."""
        m = self._model_with_history()
        m.months = ["2024-01", "2024-02"]
        m.values = [100.0, 120.0]
        m._invalidate_cache()

        wf = m._evaluate_walk_forward("ridge")
        assert wf["r2"] is None
        assert wf["folds"] == 0
        assert m.accuracy("ridge") == 0.0

    def test_forecast_reports_per_model_accuracy(self):
        """The endpoint's accuracy field must match the requested model."""
        m = self._model_with_history()
        for model_type in ("ridge", "linear", "gradient-boosting"):
            result = m.forecast(timeframe="monthly", model_type=model_type)
            assert result["model_type"] == model_type
            assert result["accuracy"] == m.accuracy(model_type)
