from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from jose import jwt
from datetime import datetime, timedelta
from supabase_auth.errors import AuthApiError, AuthWeakPasswordError
from app.config import get_settings
from app.database import get_supabase, get_supabase_admin
from app.security import CurrentUser, require_owner

router = APIRouter()
settings = get_settings()


# --- Models ---
class OwnerLoginRequest(BaseModel):
    email: str
    password: str

PASSWORD_MIN = 8
PASSWORD_MAX_BYTES = 72  # Supabase Auth (bcrypt) refuses longer


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    # Checked here, before anything is sent to Supabase. Same sentences as
    # the Settings form, which checks first.
    @field_validator("new_password")
    @classmethod
    def validate_new(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN:
            raise ValueError(f"New password must be at least {PASSWORD_MIN} characters.")
        if len(v.encode("utf-8")) > PASSWORD_MAX_BYTES:
            raise ValueError("New password is too long. Keep it under 70 characters.")
        if not v.strip():
            raise ValueError("New password can't be only spaces.")
        return v

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


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: CurrentUser = Depends(require_owner)):
    """Her own password, from Settings, so Jae never knows it: he gives her a
    temporary one at handover and she changes it here.

    A wrong current password is a 400, not a 401: she is still logged in,
    she just mistyped it.
    """
    if body.new_password == body.current_password:
        raise HTTPException(status_code=422, detail="New password must be different from the current one.")

    admin = get_supabase_admin()
    # Whose password: from her staff row, never from the request.
    staff = admin.table("staff").select("auth_user_id")\
        .eq("id", user.staff_id).eq("business_id", user.business_id)\
        .limit(1).execute()
    auth_user_id = staff.data[0]["auth_user_id"] if staff.data else None
    if not auth_user_id:
        raise HTTPException(status_code=409, detail="This account has no login to change. Ask Jae.")
    email = admin.auth.admin.get_user_by_id(auth_user_id).user.email

    # Check the current password by signing in on a NEW anon client
    # (get_supabase). Never on the admin client: a sign-in switches a
    # client to the user's token (CLAUDE.md, Supabase clients).
    try:
        get_supabase().auth.sign_in_with_password({"email": email, "password": body.current_password})
    except Exception:
        raise HTTPException(status_code=400, detail="Your current password is wrong.")

    # Set the new one as the service role, by id. Nothing here signs in.
    try:
        admin.auth.admin.update_user_by_id(auth_user_id, {"password": body.new_password})
    except (AuthWeakPasswordError, AuthApiError) as e:
        # Supabase's own rules, if they're stricter than ours.
        if isinstance(e, AuthWeakPasswordError) or getattr(e, "code", None) == "weak_password":
            raise HTTPException(status_code=422, detail=f"That password is too weak. {e.message}")
        raise
    return {"changed": True}


# Staff PIN login was removed before handover: it was unauthenticated, took
# business_id from the client, had no limit on PIN attempts, and nothing
# called it. Staff accounts are a later phase; build it again then, with the
# business resolved server-side and attempts rate-limited.
