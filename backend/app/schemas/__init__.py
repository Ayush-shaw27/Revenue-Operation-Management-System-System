"""Pydantic schemas for request/response validation."""
import re
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# Deliberately permissive: RFC 5322 is famously unspecifiable, so this rejects
# the obvious junk (no @, no domain, spaces) without rejecting valid-but-unusual
# addresses the way a strict regex or a full RFC validator does.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")


def _validate_email(value: str) -> str:
    v = (value or "").strip().lower()
    if not v:
        raise ValueError("Email is required")
    if not _EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address")
    return v


def _validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value) > 128:
        # bcrypt silently truncates beyond 72 *bytes*, so anything longer is
        # either a mistake or a way to make two different passwords collide.
        raise ValueError("Password must be at most 128 characters")
    return value


class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: bool
    service: str


class LeadScoreRequest(BaseModel):
    name: str
    company: str
    value: float
    source: str
    touchpoints: Optional[int] = 3
    industry: Optional[str] = "Technology"
    company_size: Optional[str] = "Enterprise"


class LeadScoreResponse(BaseModel):
    score: int
    label: str
    conversion_probability: float
    confidence: int
    factors: List[str]
    top_feature_contributions: Optional[List[dict]] = None


class RevenueForecastRequest(BaseModel):
    timeframe: str = "monthly"
    model_type: str = "ridge"
    periods_ahead: Optional[int] = 3


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
# ---------------------------------------------------------------------------
# CRM schemas
# ---------------------------------------------------------------------------
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
    ai_factors: Optional[list] = None


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


def _optional_email(value):
    return _validate_email(value) if value is not None else None


def _optional_password(value):
    return _validate_password(value) if value is not None else None


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str
    password: str
    role: Literal["admin", "manager", "sales-executive"] = "sales-executive"

    _normalise_email = field_validator("email")(_validate_email)
    _check_password = field_validator("password")(_validate_password)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[str] = None
    password: Optional[str] = None
    # Literals, not free strings: an admin PATCH previously persisted any
    # string into `role`, which silently locked the account out of every
    # role-gated route.
    role: Optional[Literal["admin", "manager", "sales-executive"]] = None
    status: Optional[Literal["active", "inactive"]] = None

    _normalise_email = field_validator("email")(_optional_email)
    _check_password = field_validator("password")(_optional_password)


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


# ---------------------------------------------------------------------------
# Copilot / analytics extras (documented endpoints)
# ---------------------------------------------------------------------------
class CopilotRequest(BaseModel):
    # Capped at 2000 chars.  Every character is a token you pay for, and with
    # open registration an uncapped endpoint is a way for anyone to hand you a
    # very large bill.
    question: str = Field(..., min_length=1, max_length=2000)


class CopilotResponse(BaseModel):
    question: str
    answer: str
    # "grok" when the answer was generated by the AI provider,
    # "local-rules" when it came from the deterministic fallback.
    provider: str
    model: Optional[str] = None
    # Explains *why* the provider was or was not used (e.g. missing credentials).
    note: Optional[str] = None
    metrics: Optional[dict] = None


class ForecastScenarioRequest(BaseModel):
    discount: float = 0.0
    headcount: int = 1
    factor: float = 1.0
    timeframe: str = "monthly"
    model_type: str = "ridge"


class ExecSummary(BaseModel):
    generated_at: str
    total_pipeline_value: float
    open_deals: int
    closed_won_value: float
    closed_won_count: int
    win_rate: float
    avg_deal_value: float
    total_leads: int
    high_value_deals: int
    at_risk_accounts: int
    leading_source: str
    revenue_forecast_metric: float