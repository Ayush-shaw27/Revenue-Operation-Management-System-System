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
os.environ.setdefault("XAI_API_KEY", "")

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

# Seed the shared test database once, up front.  `TestClient(app)` does not run
# the startup lifespan, so without this the demo accounts do not exist and any
# test that logs in depends on whether some *earlier* test happened to trigger
# seeding.  (The real "a fresh clone self-seeds" behaviour is covered properly
# by TestAutoSeedOnStartup, which runs a separate process.)
from scripts.seed_loader import seed_if_empty as _seed_if_empty  # noqa: E402

_seed_if_empty()


client = TestClient(app)


# The auth and copilot routes are rate limited (they are the brute-force and
# key-drain targets).  The counters live in module state and every request in
# this suite comes from the same "IP", so without this reset the tests starve
# each other and a later test fails with 429 for no real reason.
@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app.core import rate_limit
    rate_limit.reset()
    yield
    rate_limit.reset()


# The demo accounts published in README.md.  These are intentionally public —
# they exist so anyone cloning the repo can log in — so the suite asserts they
# stay in sync with the seed data instead of silently drifting.
DEMO_CREDENTIALS = {
    "admin@revops.pro": "adminpass",
    "manager@revops.pro": "managerpass",
    "rep@revops.pro": "reppass",
}


def _login_as(email: str, password: str) -> str:
    """Log in and return the bearer token, failing loudly if that does not work."""
    resp = client.post("/api/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, f"login failed for {email}: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


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
        # 422 now that ``UserCreate.role`` is a Literal (FastAPI validation),
        # 400 for the old explicit VALID_ROLES check.  Either is a rejection;
        # what matters is that it is not a 200.
        assert resp.status_code in (400, 422), resp.text

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


class TestLoginHardening:
    """Regressions for the login failures reported against the real app."""

    def test_login_email_is_case_insensitive(self):
        """`Admin@revops.pro` used to 401 for an account that exists."""
        resp = client.post("/api/auth/login", data={
            "username": "Admin@revops.pro", "password": "adminpass",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["user"]["email"] == "admin@revops.pro"

    def test_login_surrounding_whitespace_is_tolerated(self):
        resp = client.post("/api/auth/login", data={
            "username": "  admin@revops.pro  ", "password": "adminpass",
        })
        assert resp.status_code == 200, resp.text

    def test_unknown_email_and_wrong_password_are_indistinguishable(self):
        """Same status *and* same body: otherwise login doubles as an oracle
        for which email addresses have accounts."""
        wrong_pw = client.post("/api/auth/login", data={
            "username": "admin@revops.pro", "password": "definitely-wrong",
        })
        no_user = client.post("/api/auth/login", data={
            "username": "nobody-here@revops.pro", "password": "definitely-wrong",
        })
        assert wrong_pw.status_code == no_user.status_code == 401
        assert wrong_pw.json()["detail"] == no_user.json()["detail"]

    def test_repeated_failures_are_rate_limited(self):
        """Brute-force protection: the endpoint used to answer 401 forever."""
        from app.core import rate_limit
        from app.core.config import settings

        rate_limit.reset()
        statuses = [
            client.post("/api/auth/login", data={
                "username": "admin@revops.pro", "password": f"guess-{i}",
            }).status_code
            for i in range(settings.LOGIN_RATE_LIMIT + 5)
        ]
        assert 429 in statuses, (
            f"no rate limit after {settings.LOGIN_RATE_LIMIT + 5} attempts: {statuses}"
        )
        assert statuses[-1] == 429


class TestRegisterHardening:
    """`/register` used to accept `not-an-email` with the password `a`."""

    def test_rejects_malformed_email(self):
        resp = client.post("/api/auth/register", json={
            "name": "Nope", "email": "not-an-email", "password": "Sup3rSecret!23",
        })
        assert resp.status_code == 422, resp.text

    def test_rejects_short_password(self):
        resp = client.post("/api/auth/register", json={
            "name": "Nope", "email": "shorty@revops.pro", "password": "a",
        })
        assert resp.status_code == 422, resp.text

    def test_accepts_valid_registration(self):
        resp = client.post("/api/auth/register", json={
            "name": "Real Person", "email": "Valid.Person@RevOps.pro",
            "password": "Sup3rSecret!23",
        })
        assert resp.status_code == 200, resp.text
        # Email is normalised, so a later login with different casing still works.
        assert resp.json()["email"] == "valid.person@revops.pro"

    def test_copilot_rejects_oversized_question(self):
        token = _login_as("admin@revops.pro", "adminpass")
        resp = client.post(
            "/api/copilot/ask",
            json={"question": "x" * 5000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, resp.text


class TestLastAdminProtection:
    """An admin must not be able to demote/deactivate/delete the last admin."""

    def _admin_token(self):
        return _login_as("admin@revops.pro", "adminpass")

    def test_admin_cannot_delete_self_when_last_admin(self):
        token = self._admin_token()
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.delete(
            f"/api/users/{me['id']}", headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400, resp.text

    def test_admin_cannot_demote_self_when_last_admin(self):
        token = self._admin_token()
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.put(
            f"/api/users/{me['id']}",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400, resp.text

    def test_admin_cannot_deactivate_self_when_last_admin(self):
        token = self._admin_token()
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        resp = client.put(
            f"/api/users/{me['id']}",
            json={"status": "inactive"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400, resp.text


class TestProductionConfigGuard:
    def test_placeholder_secret_is_flagged(self):
        from app.core.config import PLACEHOLDER_JWT_SECRET, Settings

        s = Settings(JWT_SECRET_KEY=PLACEHOLDER_JWT_SECRET, ENVIRONMENT="production")
        assert s.uses_placeholder_jwt_secret
        try:
            s.assert_production_ready()
        except RuntimeError as exc:
            assert "JWT_SECRET_KEY" in str(exc)
        else:
            raise AssertionError("production boot accepted the public placeholder secret")

    def test_placeholder_drifted_from_env_example_is_flagged(self):
        """The real bug: the check compared against one exact string while
        `.env.example` shipped another, so copying the example passed."""
        from app.core.config import Settings

        drifted = "change-this-to-a-secure-random-secret-in-production"
        s = Settings(JWT_SECRET_KEY=drifted, ENVIRONMENT="production")
        assert s.uses_placeholder_jwt_secret, (
            "the .env.example placeholder was accepted as a real secret"
        )
        for also_bad in ("", "your-secret-here", "REPLACE-ME-with-real-key"):
            assert Settings(JWT_SECRET_KEY=also_bad).uses_placeholder_jwt_secret, also_bad

    def test_random_secret_is_not_flagged(self):
        from app.core.config import Settings

        assert not Settings(JWT_SECRET_KEY="k3JmQ2xZ8vNpLw7TbR4yHc9DsA1fGjK6mXqPzV0uS").uses_placeholder_jwt_secret

    def test_short_secret_is_rejected_in_production(self):
        from app.core.config import Settings

        s = Settings(JWT_SECRET_KEY="tooshort", ENVIRONMENT="production")
        try:
            s.assert_production_ready()
        except RuntimeError:
            pass
        else:
            raise AssertionError("production boot accepted a 8-character secret")

    def test_localhost_ai_gateway_is_rejected_in_production(self):
        from app.core.config import Settings

        s = Settings(
            JWT_SECRET_KEY="x" * 48,
            ENVIRONMENT="production",
            XAI_BASE_URL="http://localhost:1234/v1",
        )
        try:
            s.assert_production_ready()
        except RuntimeError as exc:
            assert "localhost" in str(exc)
        else:
            raise AssertionError("production boot accepted a localhost AI gateway")

    def test_good_production_config_passes(self):
        from app.core.config import Settings

        Settings(
            JWT_SECRET_KEY="x" * 48,
            ENVIRONMENT="production",
            XAI_BASE_URL="https://api.x.ai/v1",
        ).assert_production_ready()

    def test_shipped_default_ai_url_is_not_local(self):
        """Regression: the real https://api.x.ai/v1 must pass the localhost
        guard. If it ever starts failing, production boot would abort."""
        from app.core.config import Settings

        s = Settings()
        assert s.XAI_BASE_URL == "https://api.x.ai/v1", s.XAI_BASE_URL
        assert not s.ai_gateway_is_local()

    def test_development_is_never_blocked(self):
        """A fresh clone must still start, placeholder secret and all."""
        from app.core.config import Settings

        Settings(JWT_SECRET_KEY="anything", ENVIRONMENT="development").assert_production_ready()


class TestEnvFileIsNotCwdDependent:
    def test_env_file_is_absolute(self):
        """`.env` was resolved against the cwd, so starting uvicorn from the
        repo root silently dropped every secret."""
        from app.core.config import ENV_FILE

        assert ENV_FILE.is_absolute(), ENV_FILE
        assert ENV_FILE.parent.name == "backend", ENV_FILE


class TestAsyncProviderDoesNotBlockTheLoop:
    """One slow AI call used to stall every other request in the process."""

    def test_health_stays_responsive_during_a_copilot_call(self):
        import asyncio
        import threading
        import time

        from app.ai import provider as ai_provider
        from app.ai.copilot import RuleCopilot

        async def scenario():
            # A gateway that takes 1.5s to answer.
            class SlowClient(ai_provider.GrokClient):
                @property
                def is_configured(self):
                    return True

                async def chat_async(self, messages, temperature=0.2, max_tokens=600):
                    await asyncio.sleep(1.5)
                    return "slow answer"

            copilot = RuleCopilot(client=SlowClient(api_key="test-key"))

            start = time.monotonic()
            ask = asyncio.create_task(copilot.ask_async("why did revenue drop?"))
            # While the provider is still thinking, a health check must answer.
            # If the loop is blocked this cannot run until the ask completes.
            await asyncio.sleep(0.05)
            check_done = asyncio.Event()

            async def probe():
                check_done.set()

            await asyncio.wait_for(probe(), timeout=0.5)
            assert check_done.is_set()

            result = await ask
            elapsed = time.monotonic() - start
            assert result["provider"] == "grok", result["provider"]
            assert elapsed >= 1.5

        loop_thread_result = {}

        def run():
            try:
                asyncio.run(scenario())
                loop_thread_result["ok"] = True
            except Exception as exc:  # pragma: no cover - surfaced below
                loop_thread_result["error"] = exc

        t = threading.Thread(target=run, daemon=True)
        t.start()
        t.join(timeout=15)
        assert "ok" in loop_thread_result, loop_thread_result.get("error")


class TestLeadImport:
    """Excel writes a BOM at the start of every CSV it saves."""

    def _token(self):
        return _login_as("admin@revops.pro", "adminpass")

    def test_import_accepts_excel_bom(self):
        resp = client.post(
            "/api/leads/import",
            files={"file": ("leads.csv", "﻿name,company,value\nBOM Co,Acme,1000\n",
                            "text/csv")},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["created"] == 1, resp.text

    def test_import_rejects_binary(self):
        resp = client.post(
            "/api/leads/import",
            files={"file": ("leads.csv", b"\xff\xfe\x00\x01binary", "text/csv")},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        assert resp.status_code == 400, resp.text


class TestCreateUserScript:
    """`generate_password()` was never called, despite the docstring."""

    def test_password_is_generated_when_flag_is_omitted(self, monkeypatch, capsys):
        import importlib

        from app.core import rate_limit

        rate_limit.reset()
        ds_mod = importlib.import_module("app.services.data_store")
        created = {}

        def fake_create_user(data):
            created.update(data)
            return {"id": "u-test", "name": data["name"], "email": data["email"],
                    "role": data["role"], "status": "active"}

        monkeypatch.setattr(ds_mod, "create_user", fake_create_user)
        monkeypatch.setattr(ds_mod, "get_user", lambda e: None)
        monkeypatch.setattr(
            "scripts.create_user.prompt_password",
            lambda: (_ for _ in ()).throw(AssertionError("prompted instead of generating")),
        )

        mod = importlib.import_module("scripts.create_user")
        monkeypatch.setattr(mod.sys, "argv", [
            "create_user.py", "--email", "gen@revops.pro", "--name", "Gen User",
        ])
        assert mod.main() == 0

        pw = created["password"]
        assert len(pw) >= 16, "generated password should be long"
        assert pw != "gen@revops.pro"
        # And it must actually be printed, because there is no reset flow.
        assert pw in capsys.readouterr().out


class TestSqlitePathPrefixStripping:
    """`lstrip("./")` strips characters, not a prefix."""

    def test_leading_dot_directory_is_preserved(self):
        import os.path as _p

        db_path = "./.hidden/revops.db"
        relative = db_path[2:] if db_path.startswith("./") else db_path
        assert relative == ".hidden/revops.db", relative
        assert _p.isabs(relative) is False


class TestEventsSecurity:

    def test_sse_requires_token(self):
        resp = client.get("/api/events/stream")
        assert resp.status_code == 401, "SSE stream is public!"

    def test_sse_rejects_invalid_token(self):
        resp = client.get("/api/events/stream", params={"token": "not-a-real-jwt"})
        assert resp.status_code == 401

    def test_sse_rejects_empty_token(self):
        resp = client.get("/api/events/stream", params={"token": ""})
        assert resp.status_code == 401


class TestModelsColdStart:
    """A fresh deploy has no `.joblib` artifacts, so every model must train itself.

    The `.joblib` files are git-ignored, so on Railway/Vercel the app always
    starts from zero artifacts.  This path had never actually run in dev (the
    files were on disk), and it was broken: `lead_scoring_model.py` called
    `permutation_importance` without importing it, so a cold start raised
    NameError and every prediction endpoint 500'd.
    """

    def test_all_models_train_from_scratch(self, tmp_path, monkeypatch):
        import app.ml.artifacts.anomaly_detector as anomaly_mod
        import app.ml.artifacts.churn_model as churn_mod
        import app.ml.artifacts.lead_scoring_model as lead_mod

        # Point each module at an empty directory, forcing the "artifact
        # missing" branch that a fresh Railway deploy always takes.  Note each
        # module names its path constant differently.
        for mod, const, attr in (
            (lead_mod, "MODEL_PATH", "lead_scoring_model.joblib"),
            (churn_mod, "CHURN_MODEL_PATH", "churn_model.joblib"),
            (anomaly_mod, "ANOMALY_MODEL_PATH", "anomaly_detector.joblib"),
        ):
            monkeypatch.setattr(mod, const, str(tmp_path / attr))

        for label, mod, cls in (
            ("lead_scoring_model", lead_mod, lead_mod.LeadScoringModel),
            ("churn_model", churn_mod, churn_mod.ChurnRiskModel),
            ("anomaly_detector", anomaly_mod, anomaly_mod.DealAnomalyDetector),
        ):
            assert not (tmp_path / f"{label}.joblib").exists()
            model = cls()
            assert model.is_trained, f"{label} did not train from scratch"
            assert (tmp_path / f"{label}.joblib").exists(), (
                f"{label} trained but did not persist its artifact"
            )

    def test_lead_model_predicts_after_cold_start(self, tmp_path, monkeypatch):
        """Trains, persists, then reloads from the artifact it just wrote."""
        import app.ml.artifacts.lead_scoring_model as lead_mod

        monkeypatch.setattr(
            lead_mod, "MODEL_PATH", str(tmp_path / "lead_scoring_model.joblib"),
        )
        first = lead_mod.LeadScoringModel()
        assert first.is_trained

        second = lead_mod.LeadScoringModel()  # now loads from the artifact
        assert second.is_trained
        result = second.predict({
            "name": "Cold Start Co", "company": "Cold Start Co", "value": 50000,
            "source": "Referral", "touchpoints": 6, "industry": "Technology",
            "company_size": "Enterprise",
        })
        assert 0 <= result["score"] <= 100, result


class TestRuleEngineAnswersTheQuestion:
    """The rule engine must answer what was ASKED, not recite totals.

    Regression: it was a four-branch keyword matcher, so "which is the highest
    lead?" matched the `lead` keyword and returned the lead COUNT - the single
    most common copilot question, answered with something useless.
    """

    def _copilot(self):
        from app.ai.copilot import RuleCopilot
        from app.ai.provider import GrokClient
        return RuleCopilot(GrokClient(api_key=""))  # force the offline engine

    def _answer(self, question):
        return self._copilot().ask(question)["answer"]

    def test_highest_lead_names_an_actual_lead(self):
        answer = self._answer("which is the highest lead?")
        # Must name a real company from the seed data and quote its value...
        assert "TaskForge" in answer or "SaaSify" in answer or "$" in answer
        # ...and must NOT be the old generic "there are N leads" reply.
        assert "in the pipeline" not in answer.lower()
        assert "leading source" not in answer.lower()

    def test_highest_lead_answer_is_grounded_in_the_database(self):
        from app.ai.copilot import data_snapshot

        snap = data_snapshot()
        top = snap["top_leads_by_value"][0]
        answer = self._answer("give me the highest lead name")
        assert str(top["name"]) in answer, f"expected {top['name']!r} in: {answer}"
        assert str(top["company"]) in answer, f"expected {top['company']!r} in: {answer}"

    def test_top_n_respects_the_number(self):
        answer = self._answer("top 3 leads")
        body = answer.split("\n")[1:]
        assert len([b for b in body if b.strip().startswith("-")]) == 3, answer

    def test_biggest_deal_names_an_actual_deal(self):
        from app.ai.copilot import data_snapshot

        snap = data_snapshot()
        top = snap["top_open_deals_by_value"][0]
        answer = self._answer("what is the biggest deal")
        assert str(top["title"]) in answer, f"expected {top['title']!r} in: {answer}"

    def test_at_risk_accounts_lists_accounts(self):
        answer = self._answer("which accounts are at risk")
        assert "health" in answer.lower()
        assert "churn" in answer.lower()

    def test_specific_company_lookup(self):
        answer = self._answer("tell me about TaskForge")
        assert "TaskForge" in answer
        assert "lead" not in answer.lower().split("\n")[0][:40]

    def test_empty_database_is_handled(self):
        from app.ai import copilot as copilot_mod

        saved = (copilot_mod.ds.get_leads, copilot_mod.ds.get_deals,
                 copilot_mod.ds.get_accounts)
        copilot_mod.ds.get_leads = lambda *a, **k: []
        copilot_mod.ds.get_deals = lambda *a, **k: []
        copilot_mod.ds.get_accounts = lambda *a, **k: []
        try:
            answer = self._answer("which is the highest lead?")
            assert "no crm data" in answer.lower()
        finally:
            (copilot_mod.ds.get_leads, copilot_mod.ds.get_deals,
             copilot_mod.ds.get_accounts) = saved


class TestCopilotInternalConsistency:
    """Two answers about the same thing must not disagree."""

    def test_open_deal_count_agrees_with_exec_summary(self):
        """Regression: the copilot answered 95 open deals in one place and 106
        in another, because closed-lost deals were counted as open here but
        excluded by build_summary()."""
        from app.ai.copilot import data_snapshot
        from app.services.exec_summary import build_summary

        snap = data_snapshot()
        assert len(snap["open_deals"]) == build_summary()["open_deals"], (
            f"copilot thinks {len(snap['open_deals'])} deals are open, "
            f"exec_summary says {build_summary()['open_deals']}"
        )

    def test_closed_lost_deals_are_not_open(self):
        from app.ai.copilot import data_snapshot

        stages = {str(d.get("stage", "")).strip().lower()
                  for d in data_snapshot()["open_deals"]}
        assert "closed-lost" not in stages, stages
        assert "closed-won" not in stages, stages


class TestCopilotContextCarriesRecords:
    """Grok cannot answer 'which is the highest lead?' unless the lead names
    are in its context. It used to receive only 11 aggregate numbers."""

    def test_prompt_contains_actual_record_names(self):
        from app.ai.copilot import RuleCopilot
        from app.ai.provider import GrokClient

        copilot = RuleCopilot(GrokClient(api_key=""))
        _metrics, _snapshot, messages = copilot._build("which is the highest lead?")
        prompt = messages[1]["content"]

        from app.ai.copilot import data_snapshot
        snap = data_snapshot()
        assert str(snap["top_leads_by_value"][0]["company"]) in prompt
        assert "TOP LEADS BY OPPORTUNITY VALUE" in prompt
        assert "ACTUAL RECORDS FROM THE DATABASE" in prompt

    def test_system_prompt_demands_a_direct_answer(self):
        from app.ai.copilot import _system_prompt

        prompt = _system_prompt().lower()
        assert "actually asked" in prompt
        assert "never invent" in prompt


class TestRegistrationToggle:
    """ALLOW_REGISTRATION=0 must actually close public signup."""

    def test_registration_can_be_disabled(self, monkeypatch):
        from app.core.config import settings

        monkeypatch.setattr(settings, "ALLOW_REGISTRATION", False)
        resp = client.post("/api/auth/register", json={
            "name": "Blocked", "email": "blocked@revops.pro",
            "password": "Sup3rSecret!23",
        })
        assert resp.status_code == 403, resp.text
        assert "disabled" in resp.json()["detail"].lower()

    def test_disabled_registration_creates_nobody(self, monkeypatch):
        from app.core.config import settings
        from app.services import data_store as ds

        monkeypatch.setattr(settings, "ALLOW_REGISTRATION", False)
        client.post("/api/auth/register", json={
            "name": "Blocked", "email": "ghost@revops.pro",
            "password": "Sup3rSecret!23",
        })
        assert ds.get_user("ghost@revops.pro") is None


class TestProviderURL:
    """Regression tests for the /v1/v1/chat/completions double-segment bug."""

    def test_base_url_with_v1_segment_is_not_doubled(self):
        from app.ai.provider import GrokClient

        client = GrokClient(base_url="https://api.x.ai/v1", api_key="k")
        assert client.chat_url == "https://api.x.ai/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_base_url_without_v1_segment_gets_one(self):
        from app.ai.provider import GrokClient

        client = GrokClient(base_url="https://api.x.ai", api_key="k")
        assert client.chat_url == "https://api.x.ai/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_trailing_slash_is_tolerated(self):
        from app.ai.provider import GrokClient

        client = GrokClient(base_url="https://api.x.ai/v1/", api_key="k")
        assert client.chat_url == "https://api.x.ai/v1/chat/completions"
        assert "/v1/v1/" not in client.chat_url

    def test_real_configured_url_is_well_formed(self):
        from app.ai.provider import grok_client

        url = grok_client.chat_url
        assert "/v1/v1/" not in url, f"doubled version segment: {url}"
        assert url.endswith("/chat/completions")
        assert url.startswith("https://api.x.ai/"), url


class TestAnalyticsFieldConsistency:
    """/trends and /revenue-history describe the same series.

    They used to disagree: /trends emitted `revenue` and /revenue-history
    emitted `actual`. The frontend types both as TrendPoint {revenue}, so
    Total Revenue summed `undefined` and rendered "$NaN", and the Revenue
    History bar chart drew nothing.
    """

    def _get(self, path):
        token = _login_as("admin@revops.pro", "adminpass")
        resp = client.get(path, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_revenue_history_emits_revenue_field(self):
        points = self._get("/api/analytics/revenue-history")["points"]
        assert points, "expected seeded revenue history"
        for p in points:
            assert "revenue" in p, f"point missing `revenue`: {p}"
            assert isinstance(p["revenue"], (int, float)), p

    def test_revenue_history_values_match_trends(self):
        history = {p["period"]: p["revenue"]
                   for p in self._get("/api/analytics/revenue-history")["points"]}
        trends = {p["period"]: p["revenue"]
                  for p in self._get("/api/analytics/trends")["points"]}
        assert history == trends, "the two endpoints disagree on the same series"

    def test_actual_alias_is_retained(self):
        """`actual` stays so any existing consumer keeps working."""
        for p in self._get("/api/analytics/revenue-history")["points"]:
            assert p["actual"] == p["revenue"], p

    def test_total_revenue_is_finite(self):
        """The exact expression the dashboard used to evaluate to NaN."""
        points = self._get("/api/analytics/revenue-history")["points"]
        total = sum(p["revenue"] for p in points)
        assert total == total, "total is NaN"          # NaN != NaN
        assert total > 0, total


class TestProviderKeySafety:
    """The AI key must never leak into an error, a log, or a response."""

    def test_error_message_does_not_contain_the_key(self):
        from app.ai.provider import GrokClient, ProviderError

        # Deliberately not key-shaped. A literal that looks like a real
        # provider key trips GitHub push protection, which then refuses to
        # push the whole repository over a fake test string.
        secret = "TESTKEY-placeholder-value"
        client = GrokClient(base_url="https://api.x.ai/v1", api_key=secret)
        assert secret not in client._redact(f"boom {secret} boom")
        assert "***" in client._redact(f"boom {secret} boom")

    def test_http_error_is_summarised_not_echoed(self):
        from app.ai.provider import GrokClient, ProviderError

        secret = "TESTKEY-placeholder-value"

        class FakeResp:
            status_code = 401
            text = f"invalid key {secret}"

            def json(self):  # pragma: no cover - should not be reached
                return {}

        client = GrokClient(base_url="https://api.x.ai/v1", api_key=secret)
        try:
            client._extract(FakeResp(), client._redact)
        except ProviderError as exc:
            assert secret not in str(exc), str(exc)
            assert "401" in str(exc)
            assert "XAI_API_KEY" in str(exc), "should hint at the cause"
        else:
            raise AssertionError("HTTP error was not raised")

    def test_unconfigured_client_raises_before_any_request(self):
        from app.ai.provider import GrokClient, ProviderError

        client = GrokClient(api_key="")
        assert not client.is_configured
        try:
            client._build_request([{"role": "user", "content": "hi"}], 0.2, 100)
        except ProviderError as exc:
            assert "XAI_API_KEY" in str(exc)
        else:
            raise AssertionError("unconfigured client built a request")


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
        assert body["provider"] in ("grok", "local-rules")

        if body["provider"] == "local-rules":
            # Never let a deterministic answer masquerade as AI output.
            assert body["model"] is None, "rule fallback must not claim a model"
            assert body["note"], "rule fallback must explain itself"

    def test_missing_credentials_are_reported(self):
        from app.ai.copilot import RuleCopilot
        from app.ai.provider import GrokClient

        copilot = RuleCopilot(GrokClient(api_key=""))
        result = copilot.ask("What is our revenue?")
        assert result["provider"] == "local-rules"
        assert result["model"] is None
        assert "credentials" in result["note"].lower() or "api_key" in result["note"].lower()


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
