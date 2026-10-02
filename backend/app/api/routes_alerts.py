"""Alerts + notifications routes."""
from __future__ import annotations
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import AuthUser, get_current_user
from app.ml.artifacts.churn_model import ChurnRiskModel
from app.schemas import AlertResponse, NotificationResponse
from app.services import alert_engine
from app.services import data_store as ds

router = APIRouter(tags=["alerts"], prefix="/api")

churn_model = ChurnRiskModel()


# --------------------------------------------------------------------------- Alerts
@router.get("/alerts", response_model=List[AlertResponse])
async def list_alerts(current_user: AuthUser = Depends(get_current_user)):
    return ds.get_alerts()


@router.get("/alerts/unread-count")
async def alerts_unread_count(current_user: AuthUser = Depends(get_current_user)):
    return {"count": ds.get_unread_alert_count()}


@router.post("/alerts/regenerate", response_model=List[AlertResponse])
async def regenerate_alerts(current_user: AuthUser = Depends(get_current_user)):
    churn_predictions = churn_model.predict_many(ds.get_accounts())
    return alert_engine.evaluate(churn_predictions)


@router.post("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, current_user: AuthUser = Depends(get_current_user)):
    if not ds.mark_alert_read(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "read", "id": alert_id}


@router.post("/alerts/read-all")
async def mark_all_alerts_read(current_user: AuthUser = Depends(get_current_user)):
    return {"status": "read", "count": ds.mark_all_alerts_read()}


# --------------------------------------------------------------------------- Notifications
@router.get("/notifications", response_model=List[NotificationResponse])
async def list_notifications(current_user: AuthUser = Depends(get_current_user)):
    return ds.get_notifications()


@router.get("/notifications/unread-count")
async def notifications_unread_count(current_user: AuthUser = Depends(get_current_user)):
    return {"count": ds.get_unread_notification_count()}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: AuthUser = Depends(get_current_user)):
    if not ds.mark_notification_read(notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read", "id": notification_id}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(current_user: AuthUser = Depends(get_current_user)):
    count = ds.mark_all_notifications_read()
    return {"status": "read", "count": count}