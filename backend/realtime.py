"""backend/realtime.py
EventBus singleton — stores subscribers in-memory and provides
publish().  Phase 4 wires this to SSE StreamingResponse.
"""
from __future__ import annotations
from typing import Any, Callable, Dict, List


class EventBus:
    """Simple in-memory event bus."""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Any], None]]] = {}

    def subscribe(self, channel: str, cb: Callable[[Any], None]) -> None:
        self._subscribers.setdefault(channel, []).append(cb)

    def publish(self, channel: str, event: Any) -> None:
        for cb in self._subscribers.get(channel, []):
            try:
                cb(event)
            except Exception:
                pass

    def clear(self) -> None:
        self._subscribers.clear()


event_bus = EventBus()

class SSEHub:
    """Async generator hub for SSE subscribers (token-based)."""
    async def subscribe(self, token: str = ""):
        # Stub: yields events from event_bus or external feed
        yield {"type": "connected", "token": token}

sse_hub = SSEHub()