"""Business settings she edits herself: the Messenger payment-request template
and her GCash and Maya numbers (businesses.settings, migration 005).

The template is filled on the phone from the cart (frontend lib/composer.ts),
so the server only stores text. A key absent from settings means "use the
default" — DEFAULT_TEMPLATE below — so a better default reaches everyone who
hasn't customised theirs, and Reset is just removing the key.

business_id comes only from the token, never from the request.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.database import get_supabase_admin
from app.security import CurrentUser, require_owner

router = APIRouter()

# Sent mid-thread, after the customer has said what they want and before they
# pay — where a wrong total costs money. Taglish, the way she writes to
# customers. A line whose placeholder has nothing to fill it (no pickup time,
# no Maya number) is left out of the message, so optional details each get
# their own line.
DEFAULT_TEMPLATE = """Hi po! Eto po yung order niyo:
{items}

Total: {total}
Pickup: {pickup}

Pa-send na lang po ng payment dito:
GCash: {gcash}
Maya: {maya}

Then send niyo lang po yung screenshot ng payment. Salamat po!"""

TEMPLATE_MAX = 2000
NUMBER_RE = re.compile(r"^[0-9+\- ]{1,20}$")


class SettingsUpdate(BaseModel):
    # Each field optional: only what's sent changes. null (or "" for a
    # number) removes the key; for the template that means back to default.
    messenger_template: Optional[str] = None
    gcash_number: Optional[str] = None
    maya_number: Optional[str] = None

    @field_validator("messenger_template")
    @classmethod
    def check_template(cls, v):
        if v is None:
            return None
        v = v.replace("\r\n", "\n").strip()
        if not v:
            raise ValueError("The message can't be empty. Tap Reset to use the default.")
        if len(v) > TEMPLATE_MAX:
            raise ValueError(f"The message can be at most {TEMPLATE_MAX} characters.")
        return v

    @field_validator("gcash_number", "maya_number")
    @classmethod
    def check_number(cls, v, info):
        if v is None:
            return None
        v = " ".join(v.split())
        if v and not NUMBER_RE.match(v):
            label = "GCash" if info.field_name == "gcash_number" else "Maya"
            raise ValueError(f"The {label} number can only have digits, spaces, + and -.")
        return v


def read_settings(sb, business_id: str) -> dict:
    res = sb.table("businesses").select("settings")\
        .eq("id", business_id).is_("deleted_at", None).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="This café's account wasn't found. Please log in again.")
    return res.data[0].get("settings") or {}


def response(settings: dict) -> dict:
    return {
        "messenger_template": settings.get("messenger_template") or DEFAULT_TEMPLATE,
        "is_default_template": not settings.get("messenger_template"),
        "default_template": DEFAULT_TEMPLATE,
        "gcash_number": settings.get("gcash_number") or "",
        "maya_number": settings.get("maya_number") or "",
    }


@router.get("")
async def get_settings(user: CurrentUser = Depends(require_owner)):
    return response(read_settings(get_supabase_admin(), user.business_id))


@router.patch("")
async def update_settings(body: SettingsUpdate, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    settings = dict(read_settings(sb, user.business_id))
    for key in body.model_fields_set:
        value = getattr(body, key)
        if value:
            settings[key] = value
        else:
            settings.pop(key, None)  # null / "" -> back to default / no number
    sb.table("businesses").update({"settings": settings})\
        .eq("id", user.business_id).execute()
    return response(settings)
