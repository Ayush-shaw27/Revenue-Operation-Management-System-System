"""Health + ML prediction routes."""
from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import AuthUser, get_current_user
from app.ml.artifacts.lead_scoring_model import LeadScoringModel
from app.ml.artifacts.churn_model import ChurnRiskModel
from app.ml.artifacts.anomaly_detector import DealAnomalyDetector
from app.ml.inference.revenue_forecast_model import RevenueForecastModel
from app.ml.inference.insights_engine import PipelineInsightsEngine
from app.ml.inference.next_best_action import recommend, recommend_for_deals
from app.schemas import (
    HealthResponse, LeadScoreRequest, LeadScoreResponse,
    RevenueForecastRequest, RevenueForecastResponse, PipelineInsightsResponse,
    AnomalyDetectionResponse, ChurnPredictionResponse, NextBestActionResponse,
)
from app.services import data_store as ds
from app.services.metrics import record_ml_inference

router = APIRouter(prefix="/api", tags=["ml"])

lead_model = LeadScoringModel()
forecast_model = RevenueForecastModel()
insights_engine = PipelineInsightsEngine()
churn_model = ChurnRiskModel()
anomaly_detector = DealAnomalyDetector()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "models_loaded": lead_model.is_trained and (forecast_model.is_trained or True),
        "service": "RevOps Pro ML API",
    }


@router.post("/predict/lead-score", response_model=LeadScoreResponse)
async def predict_lead_score(request: LeadScoreRequest, current_user: AuthUser = Depends(get_current_user)):
    try:
        result = lead_model.predict(request.model_dump())
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Lead scoring error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.post("/predict/revenue-forecast", response_model=RevenueForecastResponse)
async def predict_revenue_forecast(request: RevenueForecastRequest, current_user: AuthUser = Depends(get_current_user)):
    try:
        result = forecast_model.forecast(timeframe=request.timeframe, model_type=request.model_type)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Revenue forecast error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/pipeline-insights", response_model=PipelineInsightsResponse)
async def get_pipeline_insights(current_user: AuthUser = Depends(get_current_user)):
    try:
        result = insights_engine.generate_insights()
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Insights error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.post("/predict")
async def generic_predict(payload: dict, current_user: AuthUser = Depends(get_current_user)):
    try:
        if "timeframe" in payload or "model_type" in payload:
            tf = payload.get("timeframe", "monthly")
            mt = payload.get("model_type", "ridge")
            result = forecast_model.forecast(timeframe=tf, model_type=mt)
        else:
            result = lead_model.predict(payload)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Predict error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/churn-risk", response_model=List[ChurnPredictionResponse])
async def churn_risk_all(current_user: AuthUser = Depends(get_current_user)):
    accounts = ds.get_accounts()
    try:
        result = churn_model.predict_many(accounts)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Churn risk error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/churn-risk/{account_id}", response_model=ChurnPredictionResponse)
async def churn_risk_single(account_id: str, current_user: AuthUser = Depends(get_current_user)):
    account = ds.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    try:
        result = churn_model.predict(account)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Churn risk error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/anomalies", response_model=List[AnomalyDetectionResponse])
async def anomalies_all(current_user: AuthUser = Depends(get_current_user)):
    deals = ds.get_deals()
    try:
        result = anomaly_detector.detect(deals)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/anomalies/{deal_id}", response_model=AnomalyDetectionResponse)
async def anomalies_single(deal_id: str, current_user: AuthUser = Depends(get_current_user)):
    deal = ds.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    try:
        result = anomaly_detector.detect([deal])[0]
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/next-best-actions", response_model=List[NextBestActionResponse])
async def next_best_actions_all(current_user: AuthUser = Depends(get_current_user)):
    deals = ds.get_deals()
    try:
        result = recommend_for_deals(deals)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Next best action error: {str(e)}")
    record_ml_inference(success=True)
    return result


@router.get("/predict/next-best-actions/{deal_id}", response_model=NextBestActionResponse)
async def next_best_actions_single(deal_id: str, current_user: AuthUser = Depends(get_current_user)):
    deal = ds.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    try:
        result = recommend(deal)
    except Exception as e:
        record_ml_inference(success=False)
        raise HTTPException(status_code=500, detail=f"Next best action error: {str(e)}")
    record_ml_inference(success=True)
    return {
        "deal_id": deal["id"], "deal_title": deal.get("title", ""),
        "company": deal.get("company", ""), "stage": deal.get("stage", ""),
        "recommendations": result,
    }