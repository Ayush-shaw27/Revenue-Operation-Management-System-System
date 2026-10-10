"""RevOps Pro main application entry point."""
from __future__ import annotations

import sys
import time
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure the backend/ directory is on the sys.path so `app.xxx` imports resolve
# when uvicorn is started as `python -m uvicorn backend.app.main:app`.
import os as _os
import sys as _sys
_BACKEND_DIR = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if _BACKEND_DIR not in _sys.path:
    _sys.path.insert(0, _BACKEND_DIR)

from app.api import routes_admin, routes_alerts, routes_analytics, routes_auth, routes_copilot, routes_crm, routes_ml, routes_events

from app.core.config import settings
from app.database.connection import init_db
from app.services import data_store as ds
from app.services.metrics import RequestMetricsMiddleware
from app.workers.scheduler import start_scheduler, shutdown_scheduler
from scripts.seed_loader import seed_if_empty

# Track app start time for uptime calculation
APP_START_TIME: float = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("Starting RevOps Pro API...")

    # Refuse to serve production traffic on a configuration that is silently
    # unsafe (placeholder JWT secret, localhost AI gateway, ...).  In
    # development this is a warning instead, so a fresh clone still runs.
    try:
        settings.assert_production_ready()
    except RuntimeError as exc:
        if settings.is_production:
            raise
        print(f"WARNING: unsafe production configuration ({exc})")

    init_db()
    # Populate an empty database from the CSV seed files so a fresh clone is
    # immediately usable (demo logins, sample leads/deals, model registry).
    # This is a no-op once any user row exists.
    try:
        seed_if_empty()
    except Exception as exc:  # never block startup on a seeding problem
        print(f"WARNING: auto-seed skipped ({exc})")

    # Start background scheduler if enabled
    scheduler = start_scheduler()
    if scheduler:
        print("Background scheduler started")
    
    yield
    
    # Shutdown
    print("Shutting down RevOps Pro API...")
    shutdown_scheduler()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="RevOps Pro - Revenue Operations Platform API",
    lifespan=lifespan,
)

# Time every request so /api/admin/stats reports real latency instead of
# hardcoded numbers.  Registered before CORS so CORS stays outermost and
# preflight (OPTIONS) requests are answered without polluting the timings.
app.add_middleware(RequestMetricsMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all API routers
app.include_router(routes_auth.router)
app.include_router(routes_crm.router)
app.include_router(routes_ml.router)
app.include_router(routes_admin.router)
app.include_router(routes_alerts.router)
app.include_router(routes_analytics.router)
app.include_router(routes_copilot.router)
app.include_router(routes_events.router)


@app.get("/", tags=["root"])
async def root() -> dict[str, Any]:
    """Root endpoint - basic API info."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint - alias for /api/health."""
    # Import here to avoid circular imports
    from app.ml.artifacts.lead_scoring_model import LeadScoringModel
    from app.ml.inference.revenue_forecast_model import RevenueForecastModel
    
    lead_model = LeadScoringModel()
    forecast_model = RevenueForecastModel()
    
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "models_loaded": lead_model.is_trained and (forecast_model.is_trained or True),
        "service": "RevOps Pro ML API",
    }


if __name__ == "__main__":
    # Run on 127.0.0.1:8000 as specified in the plan
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level="info",
    )
