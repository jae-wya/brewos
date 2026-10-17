"""Queue board and today's stats. business_id comes only from the token
(app/security.py), never from the path."""
from fastapi import APIRouter, Depends
from app.database import get_supabase_admin
from app.business_day import get_business_tz, local_today, day_bounds
from app.security import CurrentUser, require_owner
from app.routers.sales import paid_orders, revenue_of

router = APIRouter()

ACTIVE_STATUSES = ["pending", "brewing", "ready"]

@router.get("")
def get_queue(user: CurrentUser = Depends(require_owner)):
    """Returns all active orders for the queue board."""
    supabase = get_supabase_admin()

    res = supabase.table("orders")\
        .select("*, order_items(*, order_item_modifiers(*))")\
        .eq("business_id", user.business_id)\
        .in_("status", ACTIVE_STATUSES)\
        .is_("deleted_at", None)\
        .order("created_at")\
        .execute()

    # Group by status for the board
    queue = {"pending": [], "brewing": [], "ready": []}
    for order in res.data:
        queue[order["status"]].append(order)

    return queue


@router.get("/stats")
def get_today_stats(user: CurrentUser = Depends(require_owner)):
    """Basic today stats for the dashboard."""
    supabase = get_supabase_admin()

    tz = get_business_tz(supabase, user.business_id)
    today = local_today(tz)
    start, end = day_bounds(tz, today)

    res = supabase.table("orders")\
        .select("total_amount, status, payment_status")\
        .eq("business_id", user.business_id)\
        .gte("created_at", start)\
        .lt("created_at", end)\
        .is_("deleted_at", None)\
        .execute()

    orders = res.data
    total_orders = len(orders)
    completed = [o for o in orders if o["status"] == "picked_up"]

    # Revenue by the same rule as GET /sales (paid, not cancelled, on the day
    # it was paid), so the dashboard and the sales page can't disagree.
    total_revenue = revenue_of(paid_orders(supabase, user.business_id, start, end, "total_amount"))

    return {
        "date": today.isoformat(),
        "timezone": tz.key,
        "total_orders": total_orders,
        "completed_orders": len(completed),
        "cancelled_orders": len([o for o in orders if o["status"] == "cancelled"]),
        "total_revenue": float(total_revenue),
        "active_orders": len([o for o in orders if o["status"] in ACTIVE_STATUSES])
    }