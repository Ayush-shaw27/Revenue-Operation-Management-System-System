from typing import List, Optional
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: bool
    service: str

class LeadScoreRequest(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Acme Corp Lead"})
    company: str = Field(..., json_schema_extra={"example": "Acme Corp"})
    value: float = Field(..., json_schema_extra={"example": 50000.0})
    source: str = Field(..., json_schema_extra={"example": "Website"})
    touchpoints: Optional[int] = Field(default=3, json_schema_extra={"example": 4})
    industry: Optional[str] = Field(default="Technology", json_schema_extra={"example": "Technology"})
    company_size: Optional[str] = Field(default="Enterprise", json_schema_extra={"example": "Enterprise"})

class LeadScoreResponse(BaseModel):
    score: int
    label: str
    conversion_probability: float
    confidence: int
    factors: List[str]
    top_feature_contributions: Optional[List[dict]] = None

class RevenueForecastRequest(BaseModel):
    timeframe: str = Field(default="monthly", json_schema_extra={"example": "monthly"})
    model_type: str = Field(default="ridge", json_schema_extra={"example": "ridge"})
    periods_ahead: Optional[int] = Field(default=3, json_schema_extra={"example": 3})

class ForecastDataPoint(BaseModel):
    period: str
    actual: float
    traditional: float
    mlForecast: float
    confidence: int
    lower_bound: float
    upper_bound: float

class RevenueForecastResponse(BaseModel):
    timeframe: str
    model_type: str
    accuracy: float
    model_description: str
    data: List[ForecastDataPoint]
    traditional_total: float
    ml_projected_total: float
    variance_percentage: float
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2: Optional[float] = None

class InsightItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    confidence: float
    actionable: bool
    metric_affected: str
    evidence: Optional[str] = None
    recommendation: Optional[str] = None

class PipelineInsightsResponse(BaseModel):
    pipeline_health_score: float
    win_rate_estimate: float
    total_pipeline_value: float
    total_deals: int
    insights: List[InsightItem]

class LeadCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str
    status: str = "new"
    source: str = "Website"
    value: float = 0
    industry: str = "Technology"
    company_size: str = "Mid-Market"
    touchpoints: int = 3
    notes: str = ""

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    value: Optional[float] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    touchpoints: Optional[int] = None
    notes: Optional[str] = None

class LeadResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    company: str
    status: str
    source: str
    value: float
    industry: str
    company_size: str
    touchpoints: int
    notes: str
    created_at: str
    ai_score: Optional[int] = None
    ai_label: Optional[str] = None
    ai_factors: Optional[List[str]] = None

class DealCreate(BaseModel):
    title: str
    company: str
    value: float = 0
    probability: int = 50
    owner: str = "System"
    close_date: Optional[str] = None
    stage: str = "prospecting"

class DealUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    value: Optional[float] = None
    probability: Optional[int] = None
    owner: Optional[str] = None
    close_date: Optional[str] = None
    stage: Optional[str] = None

class DealResponse(BaseModel):
    id: str
    title: str
    company: str
    value: float
    probability: int
    owner: str
    close_date: Optional[str]
    stage: str
    ai_recommendation: Optional[str]
    is_anomalous: bool
    days_in_stage: int
    created_at: str

class ActivityCreate(BaseModel):
    deal_id: Optional[str] = None
    lead_id: Optional[str] = None
    type: str
    content: str

class ActivityResponse(BaseModel):
    id: str
    deal_id: Optional[str]
    lead_id: Optional[str]
    type: str
    author: str
    content: str
    created_at: str

class AccountResponse(BaseModel):
    id: str
    name: str
    industry: str
    contract_value: float
    last_activity_days: int
    usage_trend: float
    ticket_count: int
    renewal_in_days: int
    health_score: float

class ChurnPredictionResponse(BaseModel):
    account_id: str
    account_name: str
    risk_score: float
    tier: str
    confidence: int
    top_factors: List[dict]
    model_version: str

class AnomalyDetectionResponse(BaseModel):
    deal_id: str
    deal_title: str
    company: str
    value: float
    stage: str
    days_in_stage: int
    anomaly_score: float
    is_anomalous: bool
    stalled: bool
    reasons: List[str]
    model_version: str

class NextBestActionResponse(BaseModel):
    deal_id: str
    deal_title: str
    company: str
    stage: str
    recommendations: List[dict]

class AlertResponse(BaseModel):
    id: str
    kind: str
    severity: str
    entity_type: str
    entity_id: str
    entity_name: str
    summary: str
    read: bool
    created_at: str

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    read: bool
    created_at: str

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "sales-executive"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str
    last_login: Optional[str] = None
    created_at: Optional[str] = None

class AnalyticsFunnelResponse(BaseModel):
    by: str
    funnel: List[dict]

class AnalyticsCohortsResponse(BaseModel):
    cohorts: List[dict]

class FunnelItem(BaseModel):
    name: str
    value: int
    color: Optional[str] = None

class CohortItem(BaseModel):
    cohort: str
    total: int
    converted: int
    conversion_rate: float

class ModelRegistryEntry(BaseModel):
    name: str
    version: str
    trained_at: str
    accuracy: float
    kind: str
    notes: str