from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.config import get_settings
from app.database import get_supabase_admin

router = APIRouter()
settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Models ---
class OwnerLoginRequest(BaseModel):
    email: str
    password: str

class StaffPINRequest(BaseModel):
    business_id: str
    staff_id: str
    pin: str

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
async def owner_login(body: OwnerLoginRequest):
    supabase = get_supabase_admin()
    try:
        res = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = res.user.id

    staff = supabase.table("staff")\
        .select("*")\
        .eq("auth_user_id", user_id)\
        .eq("role", "owner")\
        .single()\
        .execute()

    if not staff.data:
        raise HTTPException(status_code=403, detail="Not an owner account")

    token = create_token({
        "sub": str(user_id),
        "staff_id": staff.data["id"],
        "business_id": staff.data["business_id"],
        "role": staff.data["role"],
    })

    return TokenResponse(
        access_token=token,
        role=staff.data["role"],
        display_name=staff.data["display_name"],
        business_id=staff.data["business_id"]
    )


@router.get("/staff/{business_id}")
async def list_staff(business_id: str):
    """Returns active staff for PIN selection screen."""
    supabase = get_supabase_admin()
    res = supabase.table("staff")\
        .select("id, display_name, role")\
        .eq("business_id", business_id)\
        .eq("is_active", True)\
        .is_("deleted_at", None)\
        .neq("role", "owner")\
        .execute()
    return res.data


@router.post("/staff-login", response_model=TokenResponse)
async def staff_login(body: StaffPINRequest):
    supabase = get_supabase_admin()
    staff = supabase.table("staff")\
        .select("*")\
        .eq("id", body.staff_id)\
        .eq("business_id", body.business_id)\
        .eq("is_active", True)\
        .single()\
        .execute()

    if not staff.data:
        raise HTTPException(status_code=404, detail="Staff not found")

    if not staff.data.get("pin_hash"):
        raise HTTPException(status_code=400, detail="No PIN set for this staff")

    if not pwd_context.verify(body.pin, staff.data["pin_hash"]):
        raise HTTPException(status_code=401, detail="Invalid PIN")

    token = create_token({
        "sub": staff.data["id"],
        "staff_id": staff.data["id"],
        "business_id": staff.data["business_id"],
        "role": staff.data["role"],
    })

    return TokenResponse(
        access_token=token,
        role=staff.data["role"],
        display_name=staff.data["display_name"],
        business_id=staff.data["business_id"]
    )