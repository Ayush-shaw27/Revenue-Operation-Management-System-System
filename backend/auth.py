"""backend/auth.py
JWT authentication + role-based access control.

Roles (hierarchical): admin > manager > sales-executive > user
Passwords are hashed with bcrypt directly (passlib is not compatible with
bcrypt>=4.1). Identity is resolved against backend.data_store at request time
so user changes are picked up without a restart.
"""
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from backend.data_store import get_user

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

# Role hierarchy: higher index = more privilege
ROLE_LEVELS = {
    "sales-executive": 1,
    "manager": 2,
    "admin": 3,
}

# ---------------------------------------------------------------------------
# Password hashing (bcrypt direct)
# ---------------------------------------------------------------------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
        )
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class TokenData(BaseModel):
    username: Optional[str] = None  # email address
    role: Optional[str] = None


class User(BaseModel):
    id: str
    name: str
    email: str
    role: str
    status: str


def to_user_model(user: Dict[str, Any]) -> User:
    return User(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        status=user.get("status", "active"),
    )


# ---------------------------------------------------------------------------
# OAuth2 scheme
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT. Use the standard 'sub' claim for the identity."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenData(username=username, role=role)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    token_data = decode_token(token)
    user = get_user(token_data.username) if token_data.username else None
    if not user or user.get("status") != "active":
        raise HTTPException(status_code=404, detail="User not found")
    return to_user_model(user)


def _role_rank(role: str) -> int:
    return ROLE_LEVELS.get(role, 0)


def require_role(minimum_role: str):
    """Return a dependency that enforces role hierarchy.

    A user passes if _role_rank(user.role) >= _role_rank(minimum_role).
    This lets admins access anything, managers access manager-level routes,
    and reps only rep-level routes.
    """
    def role_checker(user: User = Depends(get_current_user)):
        if user.status != "active":
            raise HTTPException(status_code=403, detail="Account is not active")
        if _role_rank(user.role) < _role_rank(minimum_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker