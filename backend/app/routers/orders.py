from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_supabase_admin
from app.config import get_settings

router = APIRouter()
settings = get_settings()


# --- Models ---
class ModifierSelection(BaseModel):
    modifier_option_id: str
    option_name: str
    price_delta: float = 0

class OrderItemRequest(BaseModel):
    menu_item_id: Optional[str] = None
    item_name: str
    unit_price: float
    quantity: int = 1
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

    # Calculate totals
    subtotal = sum(
        (item.unit_price + sum(m.price_delta for m in item.modifiers)) * item.quantity
        for item in body.items
    )

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
    for item in body.items:
        line_total = (
            item.unit_price + sum(m.price_delta for m in item.modifiers)
        ) * item.quantity

        item_res = supabase.table("order_items").insert({
            "business_id": body.business_id,
            "order_id": order_id,
            "menu_item_id": item.menu_item_id,
            "item_name": item.item_name,
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "line_total": line_total,
            "notes": item.notes
        }).execute()

        if item.modifiers and item_res.data:
            item_id = item_res.data[0]["id"]
            mod_rows = [
                {
                    "business_id": body.business_id,
                    "order_item_id": item_id,
                    "modifier_option_id": m.modifier_option_id,
                    "option_name": m.option_name,
                    "price_delta": m.price_delta
                }
                for m in item.modifiers
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