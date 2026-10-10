"""Admin + user management routes."""
from __future__ import annotations
import time
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import AuthUser, get_current_user, require_role
from app.ml.artifacts.churn_model import ChurnRiskModel
from app.ml.artifacts.anomaly_detector import DealAnomalyDetector
from app.schemas import ModelRegistryEntry, UserCreate, UserUpdate, UserResponse
from app.services import data_store as ds

router = APIRouter(tags=["users", "admin"], prefix="/api")

churn_model = ChurnRiskModel()
anomaly_detector = DealAnomalyDetector()


# --------------------------------------------------------------------------- Users
@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: AuthUser = Depends(require_role("admin"))):
    return [
        {
            "id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"],
            "status": u["status"], "last_login": u.get("last_login"), "created_at": u.get("created_at"),
        }
        for u in ds.list_users()
    ]


@router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: AuthUser = Depends(require_role("admin"))):
    created = ds.create_user(user.model_dump())
    return {
        "id": created["id"], "name": created["name"], "email": created["email"],
        "role": created["role"], "status": created["status"],
        "last_login": created.get("last_login"), "created_at": created.get("created_at"),
    }


def _guard_last_admin(user_id: str, current_user: AuthUser) -> None:
    """Refuse edits that would leave the system with no usable admin.

    ``PUT /admin/users/{id}`` and ``DELETE /admin/users/{id}`` used to accept an
    admin demoting, deactivating or deleting *themselves*, which - if it is the
    only admin - locks everyone out of the entire admin console with no way back
    in except direct database surgery.
    """
    if user_id != current_user.id:
        return
    admins = [u for u in ds.list_users() if u.get("role") == "admin" and u.get("status") == "active"]
    if len(admins) <= 1:
        raise HTTPException(
            status_code=400,
            detail="You are the only active admin. Promote another user first.",
        )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user: UserUpdate, current_user: AuthUser = Depends(require_role("admin"))):
    if user.role is not None and user.role != "admin":
        _guard_last_admin(user_id, current_user)
    if user.status is not None and user.status != "active":
        _guard_last_admin(user_id, current_user)

    updated = ds.update_user(user_id, user.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": updated["id"], "name": updated["name"], "email": updated["email"],
        "role": updated["role"], "status": updated["status"],
        "last_login": updated.get("last_login"), "created_at": updated.get("created_at"),
    }


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: AuthUser = Depends(require_role("admin"))):
    _guard_last_admin(user_id, current_user)
    if not ds.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted", "id": user_id}


# --------------------------------------------------------------------------- Admin
@router.get("/admin/stats")
async def admin_stats(current_user: AuthUser = Depends(require_role("admin"))):
    """Operational stats derived from real runtime measurements.

    Nothing here is a hardcoded placeholder: latency and request counts come
    from the timing middleware, ML inference counts from the prediction routes,
    and the health score is computed from those measured signals.
    """
    from app.services import metrics

    deals = ds.get_deals()
    leads = ds.get_leads()

    latency = metrics.latency_summary()
    snap = metrics.snapshot()
    proc = metrics.process_stats()

    # System-wide utilisation (used for the "system" cards).
    cpu_usage = 0.0
    memory_usage = 0.0
    try:
        import psutil

        cpu_usage = round(psutil.cpu_percent(interval=None), 1)
        memory_usage = round(psutil.virtual_memory().percent, 1)
    except Exception:
        pass

    return {
        "system_health": metrics.system_health_score(latency, snap, proc),
        "api_latency_ms": latency["p50_ms"],
        "api_latency_avg_ms": latency["avg_ms"],
        "api_latency_p95_ms": latency["p95_ms"],
        "latency_samples": latency["sample_size"],
        "requests_total": snap["requests"],
        "request_errors": snap["request_errors"],
        "error_rate_pct": snap["error_rate_pct"],
        # "today" == since this process started; expose the window so the UI
        # can label it accurately rather than implying a calendar day.
        "requests_today": snap["requests"],
        "requests_window_started_at": snap["window_started_at"],
        "ml_inferences_today": snap["ml_inferences"],
        "ml_inference_errors": snap["ml_inference_errors"],
        "active_users": len([u for u in ds.list_users() if u["status"] == "active"]),
        "cpu_usage": cpu_usage,
        "memory_usage": memory_usage,
        "process_cpu_percent": proc["cpu_percent"],
        "process_memory_percent": proc["memory_percent"],
        "process_rss_mb": proc["rss_mb"],
        "models_loaded": len(ds.get_model_registry()),
        "uptime_hours": snap["uptime_hours"],
        "total_leads": len(leads),
        "total_deals": len(deals),
        "pipeline_value": round(sum(d.get("value", 0) for d in deals), 2),
    }


def _start_time() -> float:
    # Imported lazily to avoid a circular import at module load
    from app.main import APP_START_TIME
    return APP_START_TIME


@router.get("/admin/activity")
async def admin_activity(current_user: AuthUser = Depends(require_role("admin"))):
    return {"activity": ds.get_activity(limit=50)}


@router.get("/admin/models", response_model=Dict[str, ModelRegistryEntry])
async def admin_models(current_user: AuthUser = Depends(require_role("admin"))):
    return ds.get_model_registry()


@router.post("/admin/models/{model_name}/retrain")
async def retrain_model(model_name: str, current_user: AuthUser = Depends(require_role("admin"))):
    import datetime
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    if model_name == "churn_risk":
        status_ = churn_model.retrain()
        ds.register_model("churn_risk", status_.get("version", "1.0.0"),
                          now, status_.get("accuracy", 0.0), "classifier", "Retrained churn classifier")
        return status_
    if model_name == "anomaly_detector":
        status_ = anomaly_detector.retrain()
        ds.register_model("anomaly_detector", status_.get("version", "1.0.0"),
                          now, 0.0, "detector", "Retrained anomaly detector")
        return status_
    if model_name == "lead_scoring":
        from app.ml.training.retrain import retrain_lead_model
        accuracy = retrain_lead_model()
        ds.register_model("lead_scoring", "1.1.0", now, accuracy, "classifier", "Retrained lead scoring")
        return {"name": "lead_scoring", "version": "1.1.0", "trained": True, "accuracy": accuracy}
    if model_name == "revenue_forecast":
        from app.ml.inference.revenue_forecast_model import RevenueForecastModel
        status_ = RevenueForecastModel().status()
        ds.register_model("revenue_forecast", status_.get("version", "2.0.0"),
                          now, status_.get("accuracy", 0.0), "regressor", "Retrained revenue forecast")
        return status_
    raise HTTPException(status_code=404, detail=f"Unknown model: {model_name}")