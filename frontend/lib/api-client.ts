/**
 * RevOps Pro API Client
 * Connects frontend components with the FastAPI machine learning backend.
 * All requests carry the auth token (when available).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("revops_token")
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers, cache: "no-store" })
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `HTTP error ${response.status}`
    try {
      const body = await response.json()
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("text/csv")) return (await response.text()) as unknown as T
  return response.json()
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export interface UserInfo {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export interface LoginResult {
  access_token: string
  token_type: string
  user: UserInfo
}

export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  const form = new URLSearchParams()
  form.append("username", email)
  form.append("password", password)
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  })
  return parseResponse<LoginResult>(response)
}

export async function fetchMe(): Promise<UserInfo> {
  return parseResponse<UserInfo>(await authFetch("/api/auth/me"))
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
export interface HealthCheckResult {
  status: string
  version: string
  models_loaded: boolean
  service: string
}

export async function checkBackendHealth(): Promise<HealthCheckResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`HTTP error ${response.status}`)
    return await response.json()
  } catch (error) {
    return {
      status: "disconnected",
      version: "unknown",
      models_loaded: false,
      service: "Offline (Mock fallback available)",
    }
  }
}

// ---------------------------------------------------------------------------
// Lead scoring / forecast / insights
// ---------------------------------------------------------------------------
export interface LeadScoreInput {
  name: string
  company: string
  value: number
  source: string
  touchpoints?: number
  industry?: string
  company_size?: string
}

export interface LeadScoreResult {
  score: number
  label: "Hot" | "Warm" | "Cool" | "Cold"
  conversion_probability: number
  confidence: number
  factors: string[]
}

export interface ForecastDataPoint {
  period: string
  actual: number
  traditional: number
  mlForecast: number
  confidence: number
  lower_bound: number
  upper_bound: number
}

export interface RevenueForecastResult {
  timeframe: string
  model_type: string
  accuracy: number
  model_description: string
  data: ForecastDataPoint[]
  traditional_total: number
  ml_projected_total: number
  variance_percentage: number
}

export interface AIInsightItem {
  id: string
  type: "positive" | "warning" | "neutral"
  title: string
  description: string
  confidence: number
  actionable: boolean
  metric_affected: string
}

export interface PipelineInsightsResult {
  pipeline_health_score: number
  win_rate_estimate: number
  insights: AIInsightItem[]
}

export async function scoreLeadWithML(lead: LeadScoreInput): Promise<LeadScoreResult> {
  const response = await authFetch("/api/predict/lead-score", {
    method: "POST",
    body: JSON.stringify(lead),
  })
  return parseResponse<LeadScoreResult>(response)
}

export async function fetchRevenueForecast(
  timeframe: "monthly" | "quarterly" | "yearly" = "monthly",
  modelType: "linear" | "random-forest" | "neural-network" = "random-forest"
): Promise<RevenueForecastResult> {
  try {
    const response = await authFetch("/api/predict/revenue-forecast", {
      method: "POST",
      body: JSON.stringify({ timeframe, model_type: modelType }),
    })
    return await parseResponse<RevenueForecastResult>(response)
  } catch (err) {
    return {
      timeframe,
      model_type: modelType,
      accuracy: modelType === "neural-network" ? 92 : modelType === "random-forest" ? 87 : 78,
      model_description: "Offline fallback forecast projection",
      data: [
        { period: "Jan", actual: 145000, traditional: 140000, mlForecast: 147000, confidence: 85, lower_bound: 140000, upper_bound: 154000 },
        { period: "Feb", actual: 162000, traditional: 155000, mlForecast: 159000, confidence: 87, lower_bound: 152000, upper_bound: 166000 },
        { period: "Mar", actual: 158000, traditional: 165000, mlForecast: 161000, confidence: 82, lower_bound: 153000, upper_bound: 169000 },
        { period: "Apr", actual: 189000, traditional: 180000, mlForecast: 186000, confidence: 89, lower_bound: 178000, upper_bound: 194000 },
        { period: "May", actual: 195000, traditional: 190000, mlForecast: 198000, confidence: 91, lower_bound: 190000, upper_bound: 206000 },
        { period: "Jun", actual: 0, traditional: 205000, mlForecast: 212000, confidence: 88, lower_bound: 202000, upper_bound: 222000 },
        { period: "Jul", actual: 0, traditional: 215000, mlForecast: 225000, confidence: 86, lower_bound: 213000, upper_bound: 237000 },
        { period: "Aug", actual: 0, traditional: 225000, mlForecast: 238000, confidence: 84, lower_bound: 224000, upper_bound: 252000 },
      ],
      traditional_total: 1475000,
      ml_projected_total: 1526000,
      variance_percentage: 3.5,
    }
  }
}

export async function fetchPipelineInsights(): Promise<PipelineInsightsResult> {
  const response = await authFetch("/api/predict/pipeline-insights")
  return await parseResponse<PipelineInsightsResult>(response)
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------
export interface Lead {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: string
  source: string
  value: number
  industry?: string
  company_size?: string
  created_at: string
  ai_score?: number
  ai_label?: string
  ai_factors?: string[]
  touchpoints?: number
  notes?: string
}

export async function fetchLeads(): Promise<Lead[]> {
  return parseResponse<Lead[]>(await authFetch("/api/leads"))
}

export async function createLead(data: Partial<Lead>): Promise<Lead> {
  return parseResponse<Lead>(await authFetch("/api/leads", { method: "POST", body: JSON.stringify(data) }))
}

export async function updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
  return parseResponse<Lead>(await authFetch(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }))
}

export async function deleteLead(id: string): Promise<void> {
  await parseResponse(await authFetch(`/api/leads/${id}`, { method: "DELETE" }))
}

export async function exportLeadsCSV(): Promise<string> {
  return parseResponse<string>(await authFetch("/api/leads/export"))
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------
export interface Deal {
  id: string
  title: string
  company: string
  value: number
  probability: number
  owner: string
  close_date?: string | null
  stage: string
  ai_recommendation?: string | null
  is_anomalous?: boolean
  days_in_stage?: number
  created_at?: string
}

export async function fetchDeals(): Promise<Deal[]> {
  return parseResponse<Deal[]>(await authFetch("/api/deals"))
}

export async function createDeal(data: Partial<Deal>): Promise<Deal> {
  return parseResponse<Deal>(await authFetch("/api/deals", { method: "POST", body: JSON.stringify(data) }))
}

export async function updateDeal(id: string, data: Partial<Deal>): Promise<Deal> {
  return parseResponse<Deal>(await authFetch(`/api/deals/${id}`, { method: "PUT", body: JSON.stringify(data) }))
}

export async function deleteDeal(id: string): Promise<void> {
  await parseResponse(await authFetch(`/api/deals/${id}`, { method: "DELETE" }))
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export interface Activity {
  id: string
  deal_id?: string | null
  lead_id?: string | null
  type: string
  author: string
  content: string
  created_at: string
}

export async function fetchActivities(dealId?: string, leadId?: string): Promise<Activity[]> {
  const params = new URLSearchParams()
  if (dealId) params.append("deal_id", dealId)
  if (leadId) params.append("lead_id", leadId)
  const qs = params.toString() ? `?${params.toString()}` : ""
  return parseResponse<Activity[]>(await authFetch(`/api/activities${qs}`))
}

export async function createActivity(data: { deal_id?: string; lead_id?: string; type: string; content: string }): Promise<Activity> {
  return parseResponse<Activity>(await authFetch("/api/activities", { method: "POST", body: JSON.stringify(data) }))
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export interface Account {
  id: string
  name: string
  industry: string
  contract_value: number
  last_activity_days: number
  usage_trend: number
  ticket_count: number
  renewal_in_days: number
  health_score: number
}

export async function fetchAccounts(): Promise<Account[]> {
  return parseResponse<Account[]>(await authFetch("/api/accounts"))
}

// ---------------------------------------------------------------------------
// Churn risk
// ---------------------------------------------------------------------------
export interface ChurnFactor {
  factor: string
  direction: string
  weight: number
  rank: number
}

export interface ChurnPrediction {
  account_id: string
  account_name: string
  risk_score: number
  tier: string
  confidence: number
  top_factors: ChurnFactor[]
  model_version: string
}

export async function fetchChurnRisk(): Promise<ChurnPrediction[]> {
  return parseResponse<ChurnPrediction[]>(await authFetch("/api/predict/churn-risk"))
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------
export interface AnomalyDetection {
  deal_id: string
  deal_title: string
  company: string
  value: number
  stage: string
  days_in_stage: number
  anomaly_score: number
  is_anomalous: boolean
  stalled: boolean
  reasons: string[]
  model_version: string
}

export async function fetchAnomalies(): Promise<AnomalyDetection[]> {
  return parseResponse<AnomalyDetection[]>(await authFetch("/api/predict/anomalies"))
}

// ---------------------------------------------------------------------------
// Next best actions
// ---------------------------------------------------------------------------
export interface ActionRecommendation {
  action_id: string
  action: string
  channel: string
  priority: number
  rationale: string
  rank?: number
}

export interface NextBestAction {
  deal_id: string
  deal_title: string
  company: string
  stage: string
  recommendations: ActionRecommendation[]
}

export async function fetchNextBestActions(): Promise<NextBestAction[]> {
  return parseResponse<NextBestAction[]>(await authFetch("/api/predict/next-best-actions"))
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export interface Alert {
  id: string
  kind: string
  severity: string
  entity_type: string
  entity_id: string
  entity_name: string
  summary: string
  read: boolean
  created_at: string
}

export async function fetchAlerts(): Promise<Alert[]> {
  return parseResponse<Alert[]>(await authFetch("/api/alerts"))
}

export async function fetchUnreadAlertCount(): Promise<number> {
  const data = await parseResponse<{ count: number }>(await authFetch("/api/alerts/unread-count"))
  return data.count
}

export async function regenerateAlerts(): Promise<Alert[]> {
  return parseResponse<Alert[]>(await authFetch("/api/alerts/regenerate", { method: "POST" }))
}

export async function markAlertRead(id: string): Promise<void> {
  await parseResponse(await authFetch(`/api/alerts/${id}/read`, { method: "POST" }))
}

export async function markAllAlertsRead(): Promise<void> {
  await parseResponse(await authFetch("/api/alerts/read-all", { method: "POST" }))
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export async function fetchNotifications(): Promise<Notification[]> {
  return parseResponse<Notification[]>(await authFetch("/api/notifications"))
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const data = await parseResponse<{ count: number }>(await authFetch("/api/notifications/unread-count"))
  return data.count
}

export async function markNotificationRead(id: string): Promise<void> {
  await parseResponse(await authFetch(`/api/notifications/${id}/read`, { method: "POST" }))
}

export async function markAllNotificationsRead(): Promise<void> {
  await parseResponse(await authFetch("/api/notifications/read-all", { method: "POST" }))
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export interface FunnelItem {
  name: string
  value: number
  color?: string | null
}

export async function fetchAnalyticsFunnel(by: "source" | "stage" = "source"): Promise<{ by: string; funnel: FunnelItem[] }> {
  return parseResponse(await authFetch(`/api/analytics/funnel?by=${by}`))
}

export interface CohortItem {
  cohort: string
  total: number
  converted: number
  conversion_rate: number
}

export async function fetchAnalyticsCohorts(): Promise<CohortItem[]> {
  const data = await parseResponse<{ cohorts: CohortItem[] }>(await authFetch("/api/analytics/cohorts"))
  return data.cohorts
}

// ---------------------------------------------------------------------------
// Users (admin)
// ---------------------------------------------------------------------------
export interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  last_login?: string | null
  created_at?: string | null
}

export async function fetchUsers(): Promise<User[]> {
  return parseResponse<User[]>(await authFetch("/api/users"))
}

export async function createUser(data: { name: string; email: string; password: string; role: string }): Promise<User> {
  return parseResponse<User>(await authFetch("/api/users", { method: "POST", body: JSON.stringify(data) }))
}

export async function deleteUser(id: string): Promise<void> {
  await parseResponse(await authFetch(`/api/users/${id}`, { method: "DELETE" }))
}

// ---------------------------------------------------------------------------
// Admin stats / activity
// ---------------------------------------------------------------------------
export interface AdminStats {
  system_health: number
  api_latency_ms: number
  requests_today: number
  ml_inferences_today: number
  active_users: number
  cpu_usage: number
  memory_usage: number
  models_loaded: number
  uptime_hours: number
  total_leads?: number
  total_deals?: number
  pipeline_value?: number
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return parseResponse<AdminStats>(await authFetch("/api/admin/stats"))
}

export interface AuditLog {
  id: string
  user: string
  action: string
  resource: string
  type: string
  timestamp: string
  ip: string
}

export async function fetchAdminActivity(): Promise<AuditLog[]> {
  const data = await parseResponse<{ activity: AuditLog[] }>(await authFetch("/api/admin/activity"))
  return data.activity
}

// ---------------------------------------------------------------------------
// Model registry (P3)
// ---------------------------------------------------------------------------
export interface ModelRegistryEntry {
  name: string
  version: string
  trained_at: string
  accuracy: number
  kind: string
  notes: string
}

export async function fetchModelRegistry(): Promise<Record<string, ModelRegistryEntry>> {
  return parseResponse(await authFetch("/api/admin/models"))
}

export async function retrainModel(modelName: string): Promise<Record<string, unknown>> {
  return parseResponse(await authFetch(`/api/admin/models/${modelName}/retrain`, { method: "POST" }))
}
