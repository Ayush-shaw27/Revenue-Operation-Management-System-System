"""Copilot route — grounded AI assistant backed by xAI (Grok)."""
from __future__ import annotations
from fastapi import APIRouter, Depends

from app.ai.copilot import RuleCopilot
from app.api.deps import AuthUser, get_current_user
from app.core.rate_limit import copilot_limit
from app.schemas import CopilotRequest, CopilotResponse

router = APIRouter(tags=["copilot"], prefix="/api")

copilot = RuleCopilot()


@router.post("/copilot/ask", response_model=CopilotResponse, dependencies=[Depends(copilot_limit())])
async def copilot_ask(request: CopilotRequest, current_user: AuthUser = Depends(get_current_user)):
    # ``ask_async`` keeps the event loop free while the provider is called, so a
    # slow gateway no longer stalls every other request in the process.
    result = await copilot.ask_async(request.question)
    return {
        "question": request.question,
        "answer": result["answer"],
        "provider": result["provider"],
        "model": result.get("model"),
        "note": result.get("note"),
        "metrics": result.get("context"),
    }