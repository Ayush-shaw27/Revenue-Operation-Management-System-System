'use client';

/** API client — talk to the FastAPI backend (default http://127.0.0.1:8000). */

import type {
  LoginResponse,
  User,
  Lead,
  Deal,
  Account,
  Activity,
  Alert,
  Notification,
  HealthResponse,
  ExecSummary,
  LeadScoreResponse,
  RevenueForecastResponse,
  PipelineInsightsResponse,
  ChurnPrediction,
  AnomalyDetection,
  NextBestAction,
  CopilotResponse,
  ModelRegistryEntry,
  AdminStats,
  FunnelResponse,
  CohortsResponse,
  TrendPoint,
  AuditLogEntry,
  ForecastScenarioResponse,
} from './types';

// Fall back to 127.0.0.1, not localhost: on Windows "localhost" can resolve to
// ::1 while the dev backend only binds 127.0.0.1, which fails to connect.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

/**
 * Abort a request that never settles.
 *
 * Without this the login form's spinner runs forever when the API is unreachable
 * or wedged, because fetch() never rejects on its own — the user just sees an
 * unresponsive page with no error message.
 */
const REQUEST_TIMEOUT_MS = 15000;

class TimeoutError extends Error {}

/**
 * Turn a failed login response into a message that names the actual problem.
 *
 * Only 401/403 say "wrong credentials".  Everything else is a bug or a
 * deployment problem, and telling the user their password is wrong when it is
 * not sends them into an endless retry loop against a server that is fine.
 */
async function loginErrorMessage(resp: Response): Promise<string> {
  let detail = '';
  try {
    const body = await resp.json();
    if (typeof body?.detail === 'string') detail = body.detail;
  } catch {
    /* non-JSON error body */
  }

  switch (resp.status) {
    case 401:
    case 403:
      return 'Incorrect email or password.';
    case 422:
      return detail
        ? `The server rejected the request: ${detail}`
        : 'The server rejected the request as invalid (HTTP 422).';
    case 429: {
      const retry = resp.headers.get('Retry-After');
      return retry
        ? `Too many attempts. Try again in ${retry} seconds.`
        : 'Too many attempts. Please wait and try again.';
    }
    case 404:
      return `Login endpoint not found at ${API_BASE}. Check NEXT_PUBLIC_API_URL points at the backend.`;
    default:
      return resp.status >= 500
        ? `The server had an internal error (HTTP ${resp.status}). Check the backend logs.`
        : `Login failed (HTTP ${resp.status}).`;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(
        `The API did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Is the backend running?`,
      );
    }
    throw new ApiError(0, 'Could not reach the API. Is the backend running?');
  } finally {
    clearTimeout(timer);
  }
}

export const TOKEN_KEY = 'revops_token';
export const USER_KEY = 'revops_user';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetchWithTimeout(`${API_BASE}${path}`, { ...options, headers });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  // ---- Auth -------------------------------------------------------------
  async login(email: string, password: string): Promise<LoginResponse> {
    const body = new URLSearchParams();
    body.set('username', email.trim().toLowerCase());
    body.set('password', password);
    const resp = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) {
      // Was a blanket `throw new ApiError(resp.status, 'Incorrect email or
      // password')`, so a 422 (malformed form), a 429 (rate limited), a 500
      // (server crash) and a 401 all showed the same "wrong password" text.
      // The user then retyped a correct password and still could not tell what
      // was actually wrong.  Keep 401 ambiguous on purpose - that is the only
      // response that should claim the credentials were wrong.
      throw new ApiError(resp.status, await loginErrorMessage(resp));
    }
    const data = (await resp.json()) as LoginResponse;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, data.access_token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  async me(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  },

  // ---- Health & summary --------------------------------------------------
  health: () => request<HealthResponse>('/api/health'),
  execSummary: () => request<ExecSummary>('/api/analytics/exec-summary'),

  // ---- CRM ---------------------------------------------------------------
  listLeads: () => request<Lead[]>('/api/leads'),
  createLead: (lead: Partial<Lead>) =>
    request<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(lead) }),
  updateLead: (id: string, lead: Partial<Lead>) =>
    request<Lead>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(lead) }),
  deleteLead: (id: string) =>
    request<{ status: string; id: string }>(`/api/leads/${id}`, { method: 'DELETE' }),

  listAccounts: () => request<Account[]>('/api/accounts'),
  listDeals: () => request<Deal[]>('/api/deals'),
  createDeal: (deal: Partial<Deal>) =>
    request<Deal>('/api/deals', { method: 'POST', body: JSON.stringify(deal) }),
  updateDeal: (id: string, deal: Partial<Deal>) =>
    request<Deal>(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(deal) }),
listActivities: (dealId?: string, leadId?: string) => {
    const params = new URLSearchParams();
    if (dealId) params.set('deal_id', dealId);
    if (leadId) params.set('lead_id', leadId);
    const qs = params.toString();
    return request<Activity[]>(`/api/activities${qs ? `?${qs}` : ''}`);
  },

  // ---- ML ----------------------------------------------------------------
  forecast: (timeframe = 'monthly', modelType = 'ridge') =>
    request<RevenueForecastResponse>('/api/predict/revenue-forecast', {
      method: 'POST',
      body: JSON.stringify({ timeframe, model_type: modelType }),
    }),
  pipelineInsights: () => request<PipelineInsightsResponse>('/api/predict/pipeline-insights'),
  churnRisk: () => request<ChurnPrediction[]>('/api/predict/churn-risk'),
  anomalies: () => request<AnomalyDetection[]>('/api/predict/anomalies'),
  nextBestActions: () => request<NextBestAction[]>('/api/predict/next-best-actions'),
  scoreLead: (payload: Record<string, unknown>) =>
    request<LeadScoreResponse>('/api/predict/lead-score', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---- Copilot ----------------------------------------------------------
  copilotAsk: (question: string) =>
    request<CopilotResponse>('/api/copilot/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  // ---- Alerts & notifications -------------------------------------------
  listAlerts: () => request<Alert[]>('/api/alerts'),
  unreadAlertCount: () => request<{ count: number }>('/api/alerts/unread-count'),
  markAlertRead: (id: string) =>
    request<{ status: string; id: string }>(`/api/alerts/${id}/read`, { method: 'POST' }),
  markAllAlertsRead: () => request<{ status: string; count: number }>('/api/alerts/read-all', { method: 'POST' }),
  listNotifications: () => request<Notification[]>('/api/notifications'),
  unreadNotificationCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<{ status: string; id: string }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ status: string; count: number }>('/api/notifications/read-all', { method: 'POST' }),

  // ---- Analytics --------------------------------------------------------
  funnel: (by = 'source') => request<FunnelResponse>(`/api/analytics/funnel?by=${by}`),
  cohorts: () => request<CohortsResponse>('/api/analytics/cohorts'),
  trends: () => request<{ metric: string; points: TrendPoint[] }>('/api/analytics/trends'),
  revenueHistory: () => request<{ points: TrendPoint[] }>('/api/analytics/revenue-history'),
  forecastScenario: (payload: { discount?: number; headcount?: number; factor?: number; timeframe?: string; model_type?: string }) =>
    request<import('./types').ForecastScenarioResponse>('/api/analytics/forecast-scenario', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ---- Admin ------------------------------------------------------------
  adminStats: () => request<AdminStats>('/api/admin/stats'),
  adminModels: () => request<Record<string, ModelRegistryEntry>>('/api/admin/models'),
  adminActivity: () => request<{ activity: AuditLogEntry[] }>('/api/admin/activity'),
  listUsers: () => request<User[]>('/api/users'),
};