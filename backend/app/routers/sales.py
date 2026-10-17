"""Daily sales: revenue, order count, average order and top items for one day.

A sale is a PAID order that wasn't cancelled, counted on the Asia/Manila
day it was paid (orders.paid_at, set once by migration 004's trigger).
Payment, not pickup, is the sale event: her Messenger orders are paid
before the drink is made, so a drink paid Monday and collected Tuesday is
a Monday sale.

paid_orders() is the one definition of that rule. The dashboard's "Revenue
today" (routers/queue.py) uses it too, so the two screens can't disagree.

business_id comes only from the token, never from the request.
"""
from collections import Counter
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from app.database import get_supabase_admin
from app.business_day import get_business_tz, local_today, day_bounds
from app.security import CurrentUser, require_owner

router = APIRouter()

TOP_ITEMS = 5


def paid_orders(supabase, business_id: str, start: str, end: str, columns: str) -> list:
    """Orders paid in [start, end) and not cancelled — the sales of a day."""
    return supabase.table("orders")\
        .select(columns)\
        .eq("business_id", business_id)\
        .eq("payment_status", "paid")\
        .neq("status", "cancelled")\
        .gte("paid_at", start)\
        .lt("paid_at", end)\
        .is_("deleted_at", None)\
        .execute().data


def revenue_of(orders: list) -> Decimal:
    # Decimal, not float: a day of ₱135 + ₱120 + … must add up to the peso.
    return sum((Decimal(str(o["total_amount"])) for o in orders), Decimal("0"))


@router.get("")
def get_sales(date: Optional[date] = None, user: CurrentUser = Depends(require_owner)):
    """One day's sales. With no date, today in the business's timezone."""
    supabase = get_supabase_admin()
    tz = get_business_tz(supabase, user.business_id)
    today = local_today(tz)
    day = date or today
    if day > today:
        raise HTTPException(status_code=422, detail="That day hasn't happened yet.")
    start, end = day_bounds(tz, day)

    orders = paid_orders(supabase, user.business_id, start, end,
                         "total_amount, order_items(item_name, item_category, quantity)")

    revenue = revenue_of(orders)
    count = len(orders)

    # By the names on the order lines (snapshots), so a since-renamed or
    # deleted item still shows as it was sold; Hot and Iced stay separate.
    sold = Counter()
    for o in orders:
        for line in o.get("order_items") or []:
            sold[(line["item_name"], line.get("item_category"))] += line["quantity"]
    top = sorted(sold.items(), key=lambda kv: (-kv[1], kv[0][0], kv[0][1] or ""))[:TOP_ITEMS]

    return {
        "date": day.isoformat(),
        "today": today.isoformat(),
        "timezone": tz.key,
        "revenue": float(revenue),
        "order_count": count,
        "average_order_value": float((revenue / count).quantize(Decimal("0.01"))) if count else 0,
        "top_items": [{"name": name, "category": category, "quantity": qty} for (name, category), qty in top],
    }
