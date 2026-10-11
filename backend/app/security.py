"""Who is calling, resolved once from the bearer token.

business_id comes ONLY from here — never from a path, query or body. Routes
take `user: CurrentUser = Depends(require_owner)` and scope every query by
`user.business_id`.

The JWT (see routers/auth.py create_token) only says WHO is calling. Whether
they may still call, and with what role, is read from their staff row on
every request: setting is_active = false or deleted_at cuts an account off
at its next request, without waiting up to 30 days for the token to expire.
That is how the support account is revoked, and how staff accounts will be.

A lost phone with a still-active account: deactivate that account, or rotate
JWT_SECRET on Render to sign out every device.
"""
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_supabase_admin

settings = get_settings()
bearer = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    staff_id: str
    business_id: str
    role: str


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=401, detail=message, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> CurrentUser:
    if creds is None:
        raise _unauthorized("Please log in.")
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except ExpiredSignatureError:
        raise _unauthorized("Your session has expired. Please log in again.")
    except JWTError:
        raise _unauthorized("Please log in.")

    try:
        staff_id = str(UUID(payload["staff_id"]))
        business_id = str(UUID(payload["business_id"]))
    except (KeyError, TypeError, ValueError):
        raise _unauthorized("Please log in.")

    # The staff row, not the token, decides access and role. A database error
    # here deliberately stays a 500, not a 401: a Supabase hiccup must not log
    # her out mid-shift.
    res = get_supabase_admin().table("staff")\
        .select("id, business_id, role")\
        .eq("id", staff_id)\
        .eq("business_id", business_id)\
        .eq("is_active", True)\
        .is_("deleted_at", None)\
        .limit(1)\
        .execute()
    if not res.data:
        raise _unauthorized("This account is no longer active. Please log in again.")

    row = res.data[0]
    return CurrentUser(staff_id=row["id"], business_id=row["business_id"], role=row["role"])


def require_owner(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can do this.")
    return user
