"""Operational metrics collected at runtime.

Everything here is *measured*, never hardcoded:

* request counters come from a middleware that times every HTTP call;
* inference counters are incremented by the ML routes when they run a model;
* latency is a rolling window of real response times;
* process resource usage comes from ``psutil`` and the process start time.

Counters reset on process restart, which is what "today" means for an
in-memory counter; ``since`` exposes the window start so the UI can say so.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from datetime import date
from typing import Awaitable, Callable, Deque, Dict, List

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

_lock = threading.Lock()

# Rolling window of recent request durations (milliseconds).
_LATENCY_WINDOW: Deque[float] = deque(maxlen=500)

_request_count = 0
_request_errors = 0
_ml_inferences = 0
_ml_inference_errors = 0
_window_started_at = time.time()
_window_started_date = date.today().isoformat()


def record_request(duration_ms: float, status_code: int = 200) -> None:
    """Record one finished HTTP request."""
    global _request_count, _request_errors
    with _lock:
        _request_count += 1
        if status_code >= 500:
            _request_errors += 1
        _LATENCY_WINDOW.append(float(duration_ms))


def record_ml_inference(success: bool = True) -> None:
    """Record one ML inference."""
    global _ml_inferences, _ml_inference_errors
    with _lock:
        _ml_inferences += 1
        if not success:
            _ml_inference_errors += 1


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    """Time every HTTP request and feed the admin console's latency figures.

    Each request is measured with a monotonic clock and recorded exactly once,
    whether it succeeds, is rejected by auth, or raises a 5xx.  A response that
    never arrives (unhandled exception handled by Starlette) still records a
    500 so the error counter cannot silently under-count.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            record_request((time.perf_counter() - started) * 1000.0, status_code)


def latency_summary() -> Dict[str, float]:
    """p50/p95/mean latency over the rolling window."""
    with _lock:
        samples = sorted(_LATENCY_WINDOW)
    if not samples:
        return {"avg_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "sample_size": 0}

    def _percentile(pct: float) -> float:
        if len(samples) == 1:
            return samples[0]
        k = (len(samples) - 1) * pct
        lo = int(k)
        hi = min(lo + 1, len(samples) - 1)
        return samples[lo] + (samples[hi] - samples[lo]) * (k - lo)

    return {
        "avg_ms": round(sum(samples) / len(samples), 1),
        "p50_ms": round(_percentile(0.50), 1),
        "p95_ms": round(_percentile(0.95), 1),
        "sample_size": len(samples),
    }


def snapshot() -> Dict[str, float]:
    """Current counters for the admin console."""
    with _lock:
        requests = _request_count
        errors = _request_errors
        inferences = _ml_inferences
        inference_errors = _ml_inference_errors
        started = _window_started_at
        start_date = _window_started_date
    return {
        "requests": requests,
        "request_errors": errors,
        "error_rate_pct": round((errors / requests * 100) if requests else 0.0, 2),
        "ml_inferences": inferences,
        "ml_inference_errors": inference_errors,
        "uptime_hours": round((time.time() - started) / 3600, 2),
        "window_started_at": start_date,
    }


def process_stats() -> Dict[str, float]:
    """Live CPU/memory for this process, plus system-wide utilisation."""
    out = {"cpu_percent": 0.0, "memory_percent": 0.0, "rss_mb": 0.0}
    try:
        import psutil

        proc = psutil.Process()
        out["cpu_percent"] = round(proc.cpu_percent(interval=None), 1)
        out["memory_percent"] = round(proc.memory_percent(), 1)
        out["rss_mb"] = round(proc.memory_info().rss / (1024 * 1024), 1)
    except Exception:
        # psutil is optional; report zeros rather than failing the endpoint.
        try:
            import resource  # type: ignore

            rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            # Linux reports KB, macOS reports bytes.
            out["rss_mb"] = round(rss_kb / 1024 if rss_kb < (1 << 30) else rss_kb / (1024 * 1024), 1)
        except Exception:
            pass
    return out


def system_health_score(latency: Dict[str, float], snap: Dict[str, float],
                        proc: Dict[str, float]) -> float:
    """Derive a 0-100 health score from measured signals.

    Starts at 100 and deducts for real problems: server errors, slow p95
    latency, high CPU, high memory, and failing ML inferences.
    """
    score = 100.0

    error_rate = float(snap.get("error_rate_pct", 0.0))
    score -= min(30.0, error_rate * 3.0)

    p95 = float(latency.get("p95_ms", 0.0))
    if p95 > 0:
        score -= min(25.0, max(0.0, (p95 - 250.0) / 20.0))

    cpu = float(proc.get("cpu_percent", 0.0))
    score -= min(20.0, max(0.0, (cpu - 70.0) / 3.0))

    mem = float(proc.get("memory_percent", 0.0))
    score -= min(15.0, max(0.0, (mem - 80.0) / 2.0))

    total_inf = int(snap.get("ml_inferences", 0))
    if total_inf:
        inf_err_rate = int(snap.get("ml_inference_errors", 0)) / total_inf
        score -= min(10.0, inf_err_rate * 10.0)

    return round(max(0.0, min(100.0, score)), 1)


def reset() -> None:
    """Clear all counters (used by tests)."""
    global _request_count, _request_errors, _ml_inferences, _ml_inference_errors
    global _window_started_at, _window_started_date
    with _lock:
        _request_count = 0
        _request_errors = 0
        _ml_inferences = 0
        _ml_inference_errors = 0
        _window_started_at = time.time()
        _window_started_date = date.today().isoformat()
        _LATENCY_WINDOW.clear()