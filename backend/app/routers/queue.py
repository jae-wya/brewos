from fastapi import APIRouter
from app.database import get_supabase_admin

router = APIRouter()

ACTIVE_STATUSES = ["pending", "brewing", "ready"]

@router.get("/{business_id}")
async def get_queue(business_id: str):
    """Returns all active orders for the queue board."""
    supabase = get_supabase_admin()

    res = supabase.table("orders")\
        .select("*, order_items(*, order_item_modifiers(*))")\
        .eq("business_id", business_id)\
        .in_("status", ACTIVE_STATUSES)\
        .is_("deleted_at", None)\
        .order("created_at")\
        .execute()

    # Group by status for the board
    queue = {"pending": [], "brewing": [], "ready": []}
    for order in res.data:
        queue[order["status"]].append(order)

    return queue


@router.get("/{business_id}/stats")
async def get_today_stats(business_id: str):
    """Basic today stats for the dashboard."""
    supabase = get_supabase_admin()

    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    res = supabase.table("orders")\
        .select("total_amount, status, payment_status")\
        .eq("business_id", business_id)\
        .gte("created_at", f"{today}T00:00:00")\
        .is_("deleted_at", None)\
        .execute()

    orders = res.data
    total_orders = len(orders)
    completed = [o for o in orders if o["status"] == "picked_up"]
    total_revenue = sum(
        float(o["total_amount"]) for o in completed
        if o["payment_status"] == "paid"
    )

    return {
        "date": today,
        "total_orders": total_orders,
        "completed_orders": len(completed),
        "total_revenue": total_revenue,
        "active_orders": len([o for o in orders if o["status"] in ACTIVE_STATUSES])
    }