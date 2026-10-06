from fastapi import APIRouter, HTTPException
from app.database import get_supabase_admin

router = APIRouter()


@router.get("/{business_id}")
async def get_menu(business_id: str):
    """Returns full menu with categories, items, and modifiers."""
    supabase = get_supabase_admin()

    categories = supabase.table("categories")\
        .select("*")\
        .eq("business_id", business_id)\
        .is_("deleted_at", None)\
        .order("sort_order")\
        .execute()

    items = supabase.table("menu_items")\
        .select("*, menu_item_modifiers(modifier_id)")\
        .eq("business_id", business_id)\
        .is_("deleted_at", None)\
        .order("sort_order")\
        .execute()

    modifiers = supabase.table("modifiers")\
        .select("*, modifier_options(*)")\
        .eq("business_id", business_id)\
        .is_("deleted_at", None)\
        .execute()

    # Filter out unavailable modifier options
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


@router.patch("/{business_id}/items/{item_id}/toggle")
async def toggle_item(business_id: str, item_id: str):
    """Toggle item availability."""
    supabase = get_supabase_admin()

    item = supabase.table("menu_items")\
        .select("is_available")\
        .eq("id", item_id)\
        .eq("business_id", business_id)\
        .single()\
        .execute()

    if not item.data:
        raise HTTPException(status_code=404, detail="Item not found")

    updated = supabase.table("menu_items")\
        .update({"is_available": not item.data["is_available"]})\
        .eq("id", item_id)\
        .execute()

    return updated.data


@router.patch("/{business_id}/modifier-options/{option_id}/toggle")
async def toggle_modifier_option(business_id: str, option_id: str):
    """Toggle modifier option availability (e.g. Espresso Shot, Nacho Sauce)."""
    supabase = get_supabase_admin()

    result = supabase.table("modifier_options")\
        .select("is_available")\
        .eq("id", option_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Option not found")

    supabase.table("modifier_options")\
        .update({"is_available": not result.data["is_available"]})\
        .eq("id", option_id)\
        .execute()

    return {"id": option_id, "is_available": not result.data["is_available"]}
