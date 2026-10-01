"""Copilot route — grounded AI assistant backed by OmniRoute."""
from __future__ import annotations
from fastapi import APIRouter, Depends

from app.ai.copilot import RuleCopilot
from app.api.deps import AuthUser, get_current_user
from app.schemas import CopilotRequest, CopilotResponse

router = APIRouter(tags=["copilot"], prefix="/api")

copilot = RuleCopilot()


@router.post("/copilot/ask", response_model=CopilotResponse)
async def copilot_ask(request: CopilotRequest, current_user: AuthUser = Depends(get_current_user)):
    result = copilot.ask(request.question)
    return {
        "question": request.question,
        "answer": result["answer"],
        "provider": result["provider"],
        "model": result.get("model"),
        "note": result.get("note"),
        "metrics": result.get("context"),
    }