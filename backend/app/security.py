"""Authentication helpers: password hashing, signed JWTs, role-based dependencies,
and a small in-memory rate limiter for public endpoints."""
import hashlib
import hmac
import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db

ALGORITHM = "HS256"
STAFF_ROLES = ("EMPLOYEE", "ADMIN")


# ---------- Passwords ----------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def is_password_hash(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(("$2a$", "$2b$", "$2y$"))


def verify_password(password: str, stored: Optional[str]) -> bool:
    """Checks a password against a bcrypt hash. Legacy plaintext values (from before
    hashing was introduced) are compared in constant time; callers should re-hash on success."""
    if not password or not stored:
        return False
    if is_password_hash(stored):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored.encode("utf-8"))
        except ValueError:
            return False
    return hmac.compare_digest(password.encode("utf-8"), stored.encode("utf-8"))


def validate_new_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password must be at most 72 bytes")


# ---------- Tokens ----------

@dataclass
class CurrentUser:
    id: str  # customer/employee id; empty for a verified number that hasn't registered yet
    phone: str  # +91XXXXXXXXXX — the login identity
    role: str  # CUSTOMER | EMPLOYEE | ADMIN
    name: str = ""

    @property
    def label(self) -> str:
        """Name for audit logs."""
        return self.name or self.phone

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"


def password_version(stored_password: Optional[str]) -> str:
    """Short keyed fingerprint of a staff member's stored password hash. Staff tokens carry
    it, so resetting / changing the password revokes every token issued before."""
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), (stored_password or "").encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def create_access_token(user_id: str, phone: str, role: str, name: str = "", pwv: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "phone": phone, "role": role, "name": name, "exp": expire}
    if pwv is not None:
        payload["pwv"] = pwv
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def staff_token_valid(db: Session, payload: dict) -> bool:
    """A staff token only works while the account is active, still has that role and the
    password hasn't changed since the token was issued (checked against the database on
    every request, so deactivating an employee locks them out immediately)."""
    from app.models import EmployeeModel  # local import: models imports the database layer

    emp = db.query(EmployeeModel).filter(EmployeeModel.id == payload.get("sub", "")).first()
    if not emp or not emp.isActive or emp.phone != payload.get("phone"):
        return False
    role = payload.get("role")
    if role == "ADMIN" and emp.userRole != "ADMIN":
        return False
    if role == "EMPLOYEE" and emp.userRole not in ("EMPLOYEE", "ADMIN"):
        return False
    return hmac.compare_digest(str(payload.get("pwv") or ""), password_version(emp.password))


_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[CurrentUser]:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    role = payload.get("role")
    if role not in ("CUSTOMER", "EMPLOYEE", "ADMIN") or not payload.get("phone"):
        return None
    if role in STAFF_ROLES and not staff_token_valid(db, payload):
        return None
    return CurrentUser(
        id=payload.get("sub", ""),
        phone=payload["phone"],
        role=role,
        name=payload.get("name", ""),
    )


def get_current_user(user: Optional[CurrentUser] = Depends(get_optional_user)) -> CurrentUser:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please log in to continue",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_staff(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# ---------- Rate limiting ----------

class RateLimiter:
    """Sliding-window limiter keyed by client IP + bucket. In-memory, so it is per
    process; good enough for a single Render instance."""

    def __init__(self) -> None:
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a few minutes and try again.",
                )
            hits.append(now)


rate_limiter = RateLimiter()


# Number of reverse proxies in front of the app that append to X-Forwarded-For (Render: 1).
# Only entries added by those proxies can be trusted; anything to their left is whatever the
# client chose to send (uvicorn --forwarded-allow-ips="*" trusts the leftmost entry, so
# request.client.host is spoofable too).
TRUSTED_PROXY_HOPS = max(1, int(os.getenv("TRUSTED_PROXY_HOPS", "1") or 1))


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return hops[-min(TRUSTED_PROXY_HOPS, len(hops))]
    return request.client.host if request.client else "unknown"


def rate_limit(bucket: str, limit: int, window_seconds: int):
    def dependency(request: Request) -> None:
        rate_limiter.check(f"{bucket}:{client_ip(request)}", limit, window_seconds)

    return dependency
