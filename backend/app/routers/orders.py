from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from app.database import get_supabase_admin
from app.config import get_settings

router = APIRouter()
settings = get_settings()


# --- Models ---
# Prices and names are NOT accepted from the client. The backend looks them up
# from the live menu and snapshots them onto the order (see create_order).
class ModifierSelection(BaseModel):
    modifier_option_id: str

class OrderItemRequest(BaseModel):
    menu_item_id: str
    quantity: int = Field(default=1, ge=1)
    notes: Optional[str] = None
    modifiers: List[ModifierSelection] = []

class CreateOrderRequest(BaseModel):
    business_id: str
    source: str = "walk_in"
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = "cash"
    items: List[OrderItemRequest]

class UpdateOrderStatusRequest(BaseModel):
    status: str


# --- Routes ---
@router.post("/")
async def create_order(body: CreateOrderRequest):
    supabase = get_supabase_admin()

    if not body.items:
        raise HTTPException(status_code=400, detail="Order has no items")

    # Look up live prices — the backend is the single source of truth.
    # unit_price is the item's base price; add-ons are stored separately as
    # price_delta, so line_total = (unit_price + sum(price_delta)) * quantity.
    item_ids = list({i.menu_item_id for i in body.items})
    option_ids = list({m.modifier_option_id for i in body.items for m in i.modifiers})

    items_res = supabase.table("menu_items")\
        .select("id, name, base_price")\
        .eq("business_id", body.business_id)\
        .in_("id", item_ids)\
        .is_("deleted_at", None)\
        .execute()
    menu_items = {row["id"]: row for row in items_res.data}

    options = {}
    if option_ids:
        options_res = supabase.table("modifier_options")\
            .select("id, name, price_delta")\
            .eq("business_id", body.business_id)\
            .in_("id", option_ids)\
            .execute()
        options = {row["id"]: row for row in options_res.data}

    missing = [i for i in item_ids if i not in menu_items] + \
              [o for o in option_ids if o not in options]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown menu item or option: {missing}")

    lines = []
    for item in body.items:
        menu_item = menu_items[item.menu_item_id]
        unit_price = float(menu_item["base_price"])
        mods = [options[m.modifier_option_id] for m in item.modifiers]
        line_total = (unit_price + sum(float(o["price_delta"]) for o in mods)) * item.quantity
        lines.append((item, menu_item, unit_price, mods, line_total))

    subtotal = sum(line[4] for line in lines)

    # Generate order number
    order_num_res = supabase.rpc(
        "generate_order_number",
        {"p_business_id": body.business_id}
    ).execute()
    order_number = order_num_res.data

    # Insert order
    order_res = supabase.table("orders").insert({
        "business_id": body.business_id,
        "order_number": order_number,
        "source": body.source,
        "customer_name": body.customer_name,
        "customer_contact": body.customer_contact,
        "notes": body.notes,
        "subtotal": subtotal,
        "total_amount": subtotal,
        "payment_method": body.payment_method,
        "payment_status": "unpaid",
        "status": "pending"
    }).execute()

    if not order_res.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    order = order_res.data[0]
    order_id = order["id"]

    # Insert order items + modifiers
    for item, menu_item, unit_price, mods, line_total in lines:
        item_res = supabase.table("order_items").insert({
            "business_id": body.business_id,
            "order_id": order_id,
            "menu_item_id": item.menu_item_id,
            "item_name": menu_item["name"],
            "unit_price": unit_price,
            "quantity": item.quantity,
            "line_total": line_total,
            "notes": item.notes
        }).execute()

        if mods and item_res.data:
            item_id = item_res.data[0]["id"]
            mod_rows = [
                {
                    "business_id": body.business_id,
                    "order_item_id": item_id,
                    "modifier_option_id": o["id"],
                    "option_name": o["name"],
                    "price_delta": o["price_delta"]
                }
                for o in mods
            ]
            supabase.table("order_item_modifiers").insert(mod_rows).execute()

    return {"order": order, "order_number": order_number}


@router.get("/{business_id}")
async def get_orders(business_id: str, status: Optional[str] = None):
    supabase = get_supabase_admin()

    query = supabase.table("orders")\
        .select("*, order_items(*, order_item_modifiers(*))")\
        .eq("business_id", business_id)\
        .is_("deleted_at", None)\
        .order("created_at", desc=True)

    if status:
        query = query.eq("status", status)

    res = query.execute()
    return res.data


@router.patch("/{business_id}/{order_id}/status")
async def update_order_status(
    business_id: str,
    order_id: str,
    body: UpdateOrderStatusRequest
):
    valid = ["pending", "brewing", "ready", "picked_up", "cancelled"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    supabase = get_supabase_admin()
    res = supabase.table("orders")\
        .update({"status": body.status})\
        .eq("id", order_id)\
        .eq("business_id", business_id)\
        .execute()

    return res.data


@router.patch("/{business_id}/{order_id}/payment")
async def mark_paid(business_id: str, order_id: str):
    supabase = get_supabase_admin()
    res = supabase.table("orders")\
        .update({"payment_status": "paid"})\
        .eq("id", order_id)\
        .eq("business_id", business_id)\
        .execute()
    return res.data