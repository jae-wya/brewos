from fastapi import APIRouter, Depends, HTTPException
from app.database import get_supabase_admin
from app.security import CurrentUser, require_owner

router = APIRouter()


@router.get("")
async def get_menu(include_all: bool = False, user: CurrentUser = Depends(require_owner)):
    """Returns full menu with categories, items, and modifiers.
    include_all=true returns all modifier options including unavailable (for management UI).
    include_all=false (default) filters out unavailable options (for order-taking UI).
    """
    supabase = get_supabase_admin()

    categories = supabase.table("categories")\
        .select("*")\
        .eq("business_id", user.business_id)\
        .is_("deleted_at", None)\
        .order("sort_order")\
        .execute()

    items = supabase.table("menu_items")\
        .select("*, menu_item_modifiers(modifier_id)")\
        .eq("business_id", user.business_id)\
        .is_("deleted_at", None)\
        .order("sort_order")\
        .execute()

    modifiers = supabase.table("modifiers")\
        .select("*, modifier_options(*)")\
        .eq("business_id", user.business_id)\
        .is_("deleted_at", None)\
        .execute()

    # For order-taking: filter out unavailable options
    # For management: return all so toggles can be shown
    if not include_all:
        for mod in modifiers.data:
            mod["modifier_options"] = [
                opt for opt in mod["modifier_options"]
                if opt.get("is_available", True)
            ]

    return {
        "categories": categories.data,
        "items": items.data,
        "modifiers": modifiers.data
    }


@router.patch("/items/{item_id}/toggle")
async def toggle_item(item_id: str, user: CurrentUser = Depends(require_owner)):
    """Toggle item availability."""
    supabase = get_supabase_admin()

    item = supabase.table("menu_items")\
        .select("is_available")\
        .eq("id", item_id)\
        .eq("business_id", user.business_id)\
        .is_("deleted_at", None)\
        .limit(1)\
        .execute()

    if not item.data:
        raise HTTPException(status_code=404, detail="That item no longer exists.")

    updated = supabase.table("menu_items")\
        .update({"is_available": not item.data[0]["is_available"]})\
        .eq("id", item_id)\
        .eq("business_id", user.business_id)\
        .execute()

    return updated.data


@router.patch("/modifier-options/{option_id}/toggle")
async def toggle_modifier_option(option_id: str, user: CurrentUser = Depends(require_owner)):
    """Toggle modifier option availability (e.g. Espresso Shot, Nacho Sauce)."""
    supabase = get_supabase_admin()

    result = supabase.table("modifier_options")\
        .select("is_available")\
        .eq("id", option_id)\
        .eq("business_id", user.business_id)\
        .limit(1)\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="That add-on no longer exists.")

    new_value = not result.data[0]["is_available"]
    supabase.table("modifier_options")\
        .update({"is_available": new_value})\
        .eq("id", option_id)\
        .eq("business_id", user.business_id)\
        .execute()

    return {"id": option_id, "is_available": new_value}
