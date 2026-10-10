"""Fixed-window, per-client rate limiting for the auth and AI endpoints.

Why this exists: ``/api/auth/login`` happily answered 401 forever, so a script
could try unlimited passwords; and ``/copilot/ask`` had no cap at all, which on a
public deployment means anyone who registers an account can drain the AI key.

Scope and limits — read before trusting this:

* In-process state.  It works for a single uvicorn worker, which is what a
  laptop or one small container runs.  With ``--workers N`` or several replicas
  each gets its own counters, so the effective limit is ``N x`` what you set.
  Put a real limiter at the edge (Cloudflare, nginx ``limit_req``, Vercel WAF)
  when you scale out.
* Keyed by client IP, so two users behind one office NAT share a bucket.  That
  is the safer direction to err in: too strict rather than too loose.
* Counters are pruned lazily when a bucket is touched and the map grows past
  ``_MAX_TRACKED_KEYS``, so an attacker rotating source IPs cannot grow memory
  without bound.
"""
from __future__ import annotations

import threading
import time
from typing import Callable, Dict, Tuple

from fastapi import HTTPException, Request, status

# Buckets are (window_start, count) pairs.
_hits: Dict[str, Tuple[float, int]] = {}

_lock = threading.Lock()
_MAX_TRACKED_KEYS = 10_000


def client_key(request: Request) -> str:
    """Best-effort client identity.

    ``request.client.host`` is the socket peer.  ``X-Forwarded-For`` is only
    consulted when a proxy set it, and only its first entry — but note that a
    client can forge that header when there is no trusted proxy in front, so
    treat the result as a hint, not as a security boundary.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _hit(key: str, limit: int, window: int) -> Tuple[bool, int, int]:
    """Register a hit and report ``(allowed, remaining, retry_after)``."""
    now = time.monotonic()
    with _lock:
        if len(_hits) > _MAX_TRACKED_KEYS:
            cutoff = now - max(window, 3600)
            for stale in [k for k, (start, _) in _hits.items() if start < cutoff]:
                _hits.pop(stale, None)

        window_start, count = _hits.get(key, (now, 0))
        if now - window_start >= window:
            window_start, count = now, 0
        count += 1
        _hits[key] = (window_start, count)

    retry_after = max(1, int(window - (now - window_start)))
    return count <= limit, max(0, limit - count), retry_after


def limit(limit: int, window: int, scope: str) -> Callable:
    """Build a FastAPI dependency enforcing ``limit`` hits per ``window`` seconds.

    Usage::

        @router.post("/login", dependencies=[Depends(limit_from("login"))])
    """

    def dependency(request: Request) -> None:
        allowed, remaining, retry_after = _hit(f"{scope}:{client_key(request)}", limit, window)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Too many attempts. Please wait before trying again."
                    if scope == "login"
                    else "Too many requests. Please slow down."
                ),
                headers={"Retry-After": str(retry_after)},
            )

    return dependency


def login_limit() -> Callable:
    from app.core.config import settings
    return limit(settings.LOGIN_RATE_LIMIT, settings.LOGIN_RATE_WINDOW_SECONDS, "login")


def register_limit() -> Callable:
    from app.core.config import settings
    return limit(settings.REGISTER_RATE_LIMIT, settings.RATE_LIMIT_WINDOW_SECONDS, "register")


def copilot_limit() -> Callable:
    from app.core.config import settings
    return limit(settings.COPILOT_RATE_LIMIT, settings.RATE_LIMIT_WINDOW_SECONDS, "copilot")


def reset() -> None:
    """Clear all counters.  Used by the tests."""
    with _lock:
        _hits.clear()