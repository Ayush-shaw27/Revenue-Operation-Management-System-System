"""Auth routes: login, me, register."""
from __future__ import annotations
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import AuthUser, get_current_user
from app.core.config import settings
from app.core.rate_limit import login_limit, register_limit
from app.core.security import create_access_token
from app.schemas import LeadResponse, UserCreate, UserResponse
from app.services import data_store as ds

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Roles that exist in the system.  This is NOT a list of roles a visitor may
# self-assign - see SELF_SERVICE_ROLE below.
VALID_ROLES = {"admin", "manager", "sales-executive"}

# The only role public (unauthenticated) registration may grant.  Promoting a
# user to manager/admin must go through the admin console, which is guarded by
# `require_role("admin")`.  Anything else would let anyone sign up as an admin.
SELF_SERVICE_ROLE = "sales-executive"


@router.post("/login", dependencies=[Depends(login_limit())])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Normalise before lookup: accounts are stored lowercase, and the previous
    # exact-match meant `Admin@revops.pro` failed for a user that exists.
    username = (form_data.username or "").strip().lower()

    user = ds.get_user(username)
    if not user or not ds.verify_user_password(username, form_data.password):
        # One generic message for "no such user" and "wrong password" on purpose:
        # anything more specific tells an attacker which emails are registered.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    ds.touch_login(user["id"])
    token = create_access_token(data={"sub": user["email"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"], "name": user["name"], "email": user["email"],
            "role": user["role"], "status": user["status"],
        },
    }


@router.get("/me")
async def me(current_user: AuthUser = Depends(get_current_user)):
    return {
        "id": current_user.id, "name": current_user.name,
        "email": current_user.email, "role": current_user.role,
        "status": current_user.status,
    }


@router.post("/register", response_model=UserResponse, dependencies=[Depends(register_limit())])
async def register(user: UserCreate):
    """Public self-service registration.

    The requested role is validated but then *ignored*: every self-registered
    account is created as ``sales-executive``.  Requesting ``admin`` does not
    error - it simply downgrades, so the endpoint cannot be used to probe which
    roles exist.

    Email shape and password strength are enforced by ``UserCreate``; they used
    to be accepted verbatim, so ``/register`` would create an account with the
    email ``not-an-email`` and the password ``a``.

    Set ``ALLOW_REGISTRATION=0`` to close this endpoint.  Do that before sharing
    a public URL: while it is open, anybody on the internet can create an
    account and spend the AI budget, and the copilot rate limit is per-IP so a
    shared-NAT visitor pool can collectively drain the key.
    """
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is disabled on this deployment.",
        )

    # `UserCreate` already lowercases and shape-checks; do not rely on the
    # caller having used the exact original casing.
    email = user.email
    if ds.get_user(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    created = ds.create_user(
        {**user.model_dump(), "email": email, "role": SELF_SERVICE_ROLE}
    )
    return {
        "id": created["id"], "name": created["name"], "email": created["email"],
        "role": created["role"], "status": created["status"],
        "last_login": created.get("last_login"), "created_at": created.get("created_at"),
    }