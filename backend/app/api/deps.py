"""Shared FastAPI dependencies (re-exports from core.security for clarity)."""
from app.core.security import get_current_user, require_role, Token, User as AuthUser

__all__ = ["get_current_user", "require_role", "Token", "AuthUser"]