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