"""Server-Sent Events route — streams live events from the EventBus."""
from __future__ import annotations
import asyncio
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.core.security import decode_token
from app.services import data_store as ds
from app.workers.realtime import event_bus

router = APIRouter(tags=["events"], prefix="/api")


async def _event_generator():
    try:
        while True:
            try:
                item = await asyncio.wait_for(event_bus._queue.get(), timeout=15.0)
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "{}"}
                continue
            channel = item.get("channel", "events")
            payload = item.get("event", item)
            yield {"event": channel, "data": str(payload).replace("\n", " ")}
    except asyncio.CancelledError:
        return


@router.get("/events/stream")
async def events_stream(
    request: Request,
    token: str = Query("", description="JWT access token"),
):
    """SSE endpoint used by frontend/hooks/use-events.ts.

    The browser ``EventSource`` API cannot set an Authorization header, so the
    token arrives as a query parameter.  It is verified here before any event is
    streamed - otherwise this endpoint would be an unauthenticated data leak.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")

    try:
        token_data = decode_token(token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid access token")

    user = ds.get_user(token_data.username) if token_data.username else None
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=401, detail="Inactive or unknown user")

    return EventSourceResponse(_event_generator())