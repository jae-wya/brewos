from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta
from app.config import get_settings
from app.database import get_supabase, get_supabase_admin

router = APIRouter()
settings = get_settings()


# --- Models ---
class OwnerLoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    display_name: str
    business_id: str


# --- Helpers ---
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# --- Routes ---
@router.post("/owner-login", response_model=TokenResponse)
def owner_login(body: OwnerLoginRequest):
    # Sign in on its own anon-key client. supabase-py swaps a client's
    # Authorization header to the user's token on SIGNED_IN, so signing in on
    # the service-role client would make the staff query below run as
    # `authenticated` and fail with 42501 permission denied.
    try:
        res = get_supabase().auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Wrong email or password.")

    user_id = res.user.id

    res = get_supabase_admin().table("staff")\
        .select("*")\
        .eq("auth_user_id", user_id)\
        .eq("role", "owner")\
        .eq("is_active", True)\
        .is_("deleted_at", None)\
        .limit(1)\
        .execute()

    if not res.data:
        raise HTTPException(status_code=403, detail="This account isn't set up as a café owner.")
    staff = res.data[0]

    token = create_token({
        "sub": str(user_id),
        "staff_id": staff["id"],
        "business_id": staff["business_id"],
        "role": staff["role"],
    })

    return TokenResponse(
        access_token=token,
        role=staff["role"],
        display_name=staff["display_name"],
        business_id=staff["business_id"]
    )


# Staff PIN login was removed before handover: it was unauthenticated, took
# business_id from the client, had no limit on PIN attempts, and nothing
# called it. Staff accounts are a later phase; build it again then, with the
# business resolved server-side and attempts rate-limited.
