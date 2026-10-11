"""Who is calling, resolved once from the bearer token.

business_id comes ONLY from here — never from a path, query or body. Routes
take `user: CurrentUser = Depends(require_owner)` and scope every query by
`user.business_id`.

Tokens are stateless JWTs (see routers/auth.py create_token). There is no
server-side session to revoke: if her phone is lost, rotate JWT_SECRET on
Render, which signs out every device.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel

from app.config import get_settings

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
        return CurrentUser(
            staff_id=payload["staff_id"],
            business_id=payload["business_id"],
            role=payload["role"],
        )
    except (KeyError, ValueError):
        raise _unauthorized("Please log in.")


def require_owner(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can do this.")
    return user
