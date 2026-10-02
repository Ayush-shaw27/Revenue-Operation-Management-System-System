"""EventBus singleton — in-memory pub/sub wired to SSE streaming."""
from __future__ import annotations
import asyncio
from typing import Any, Callable, Dict, List


class EventBus:
    """Simple in-memory event bus."""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Any], None]]] = {}
        self._queue: asyncio.Queue = asyncio.Queue()

    def subscribe(self, channel: str, cb: Callable[[Any], None]) -> None:
        self._subscribers.setdefault(channel, []).append(cb)

    def publish(self, channel: str, event: Any) -> None:
        payload = {"channel": channel, "event": event}
        self._queue.put_nowait(payload)
        for cb in self._subscribers.get(channel, []):
            try:
                cb(payload)
            except Exception:
                pass

    def clear(self) -> None:
        self._subscribers.clear()

    async def stream(self):
        """Yield every published event for SSE consumers."""
        while True:
            try:
                yield await self._queue.get()
            except asyncio.CancelledError:
                return


event_bus = EventBus()