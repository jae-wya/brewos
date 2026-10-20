"""Orders: create, list, advance status, mark paid.

business_id comes only from the token (app/security.py), never from the
path or body, and scopes every query here — same rule as the menu routes.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from app.database import get_supabase_admin
from app.security import CurrentUser, require_owner

router = APIRouter()


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
    # Required for an item with a large_price, absent for one that comes in
    # one size. The Large's price comes from the item, never from here.
    size: Optional[Literal["M", "L"]] = None

class CreateOrderRequest(BaseModel):
    # No business_id: it comes from the token. Unknown fields are ignored, so
    # a phone still sending one (an old bundle) can't choose the business.
    source: str = "walk_in"
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = "cash"
    # "Paid now" in the cart: a Messenger order is paid (GCash proof) before
    # it's made. paid_at is set by the database (migration 004), not here.
    paid: bool = False
    items: List[OrderItemRequest]

class UpdateOrderStatusRequest(BaseModel):
    status: str


# --- Helpers ---
# Cart problems name the item with its category, which tells Hot and Iced
# apart: "Spanish Latte (Iced Coffee)". Every message is shown to her as-is.
def item_label(row: dict) -> str:
    category = (row.get("categories") or {}).get("name")
    return f"{row['name']} ({category})" if category else row["name"]


def join_names(names: List[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def missing_items_message(supabase, business_id: str, item_ids: List[str]) -> str:
    """For cart items deleted from the menu since they were added."""
    res = supabase.table("menu_items")\
        .select("name, categories(name)")\
        .eq("business_id", business_id)\
        .in_("id", item_ids)\
        .execute()
    names = [item_label(row) for row in res.data]

    if not names:  # not even a deleted row left to name
        return "An item in the cart is no longer on the menu. Remove it and add it again."
    if len(names) == 1:
        return f"{names[0]} is no longer on the menu. Remove it from the cart."
    return f"{join_names(names)} are no longer on the menu. Remove them from the cart."


def unavailable_items_message(rows: List[dict]) -> str:
    """For cart items she turned off since they were added. A different
    remedy from deleted: she can turn it back on."""
    names = [item_label(row) for row in rows]
    if len(names) == 1:
        return f"{names[0]} is turned off right now. Turn it back on, or remove it from the cart."
    return f"{join_names(names)} are turned off right now. Turn them back on, or remove them from the cart."


def unavailable_options_message(option_rows: List[dict], carrying_items: List[dict]) -> str:
    """For add-ons she turned off since they were added to a cart item. The
    add-on can't be removed on its own, so name the cart items that carry it:
    "Oat Milk is turned off right now. Turn it back on, or remove Spanish
    Latte (Iced Coffee) from the cart." """
    options = join_names([row["name"] for row in option_rows])
    items = join_names(list(dict.fromkeys(item_label(row) for row in carrying_items)))
    if len(option_rows) == 1:
        return f"{options} is turned off right now. Turn it back on, or remove {items} from the cart."
    return f"{options} are turned off right now. Turn them back on, or remove {items} from the cart."


def option_not_offered_message(option_rows: List[dict], menu_item: dict) -> str:
    """For add-ons whose group she unlinked from (or deleted for) an item
    since it went into the cart."""
    options = join_names([row["name"] for row in option_rows])
    verb = "is" if len(option_rows) == 1 else "are"
    return f"{options} {verb} no longer offered on {item_label(menu_item)}. Remove it from the cart and add it again."


def size_changed_message(menu_item: dict) -> str:
    """For an item she gave, or took away, a Large price since it went into
    the cart. The cart's size choice no longer fits the item."""
    sizes = "Medium and Large" if menu_item["large_price"] is not None else "one size only"
    return f"{item_label(menu_item)} now comes in {sizes}. Remove it from the cart and add it again."


# The size, snapshotted as an order_item_modifiers row exactly as the Size
# add-on wrote it before migration 006, so past and new orders read the same.
# No modifier_option_id: the size isn't an add-on any more.
def size_row(menu_item: dict, size: str) -> dict:
    if size == "L":
        delta = round(float(menu_item["large_price"]) - float(menu_item["base_price"]), 2)
        return {"name": "Large (L)", "price_delta": delta}
    return {"name": "Medium (M)", "price_delta": 0}


# --- Routes ---
@router.post("/")
def create_order(body: CreateOrderRequest, user: CurrentUser = Depends(require_owner)):
    supabase = get_supabase_admin()
    biz = user.business_id

    if not body.items:
        raise HTTPException(status_code=400, detail="Order has no items")

    # Look up live prices — the backend is the single source of truth.
    # unit_price is the item's base price; add-ons and a Large are stored
    # separately as price_delta, so
    # line_total = (unit_price + sum(price_delta)) * quantity.
    item_ids = list({i.menu_item_id for i in body.items})
    option_ids = list({m.modifier_option_id for i in body.items for m in i.modifiers})

    items_res = supabase.table("menu_items")\
        .select("id, name, base_price, large_price, is_available, categories(name), menu_item_modifiers(modifier_id)")\
        .eq("business_id", biz)\
        .in_("id", item_ids)\
        .is_("deleted_at", None)\
        .execute()
    menu_items = {row["id"]: row for row in items_res.data}

    options = {}
    if option_ids:
        options_res = supabase.table("modifier_options")\
            .select("id, name, price_delta, is_available, modifier_id, modifiers(deleted_at)")\
            .eq("business_id", biz)\
            .in_("id", option_ids)\
            .execute()
        options = {row["id"]: row for row in options_res.data}

    missing_items = [i for i in item_ids if i not in menu_items]
    if missing_items:
        raise HTTPException(status_code=409, detail=missing_items_message(supabase, biz, missing_items))
    turned_off = [row for row in menu_items.values() if not row["is_available"]]
    if turned_off:
        raise HTTPException(status_code=409, detail=unavailable_items_message(turned_off))
    if any(o not in options for o in option_ids):
        raise HTTPException(status_code=409, detail="An add-on in the cart is no longer on the menu. Remove that item and add it again.")
    # Each add-on must belong to a live group linked to THAT item, not just to
    # her business: an Espresso Shot can't be ordered on Beef Nachos.
    for item in body.items:
        menu_item = menu_items[item.menu_item_id]
        linked = {link["modifier_id"] for link in menu_item["menu_item_modifiers"]}
        not_offered = [options[m.modifier_option_id] for m in item.modifiers
                       if options[m.modifier_option_id]["modifier_id"] not in linked
                       or (options[m.modifier_option_id].get("modifiers") or {}).get("deleted_at") is not None]
        if not_offered:
            raise HTTPException(status_code=409, detail=option_not_offered_message(not_offered, menu_item))
    options_off = [row for row in options.values() if not row["is_available"]]
    if options_off:
        off_ids = {row["id"] for row in options_off}
        carrying = [menu_items[i.menu_item_id] for i in body.items
                    if any(m.modifier_option_id in off_ids for m in i.modifiers)]
        raise HTTPException(status_code=409, detail=unavailable_options_message(options_off, carrying))
    # A sized item needs M or L; a one-size item takes neither.
    for item in body.items:
        menu_item = menu_items[item.menu_item_id]
        if (menu_item["large_price"] is not None) != (item.size is not None):
            raise HTTPException(status_code=409, detail=size_changed_message(menu_item))

    lines = []
    for item in body.items:
        menu_item = menu_items[item.menu_item_id]
        unit_price = float(menu_item["base_price"])
        mods = [options[m.modifier_option_id] for m in item.modifiers]
        if item.size:
            mods.insert(0, size_row(menu_item, item.size))
        line_total = (unit_price + sum(float(o["price_delta"]) for o in mods)) * item.quantity
        lines.append((item, menu_item, unit_price, mods, line_total))

    subtotal = sum(line[4] for line in lines)

    # Generate order number
    order_num_res = supabase.rpc(
        "generate_order_number",
        {"p_business_id": biz}
    ).execute()
    order_number = order_num_res.data

    # Insert order
    order_res = supabase.table("orders").insert({
        "business_id": biz,
        "order_number": order_number,
        "source": body.source,
        "customer_name": body.customer_name,
        "customer_contact": body.customer_contact,
        "notes": body.notes,
        "subtotal": subtotal,
        "total_amount": subtotal,
        "payment_method": body.payment_method,
        "payment_status": "paid" if body.paid else "unpaid",
        "status": "pending"
    }).execute()

    if not order_res.data:
        raise HTTPException(status_code=500, detail="Failed to create order")

    order = order_res.data[0]
    order_id = order["id"]

    # Insert order items + modifiers
    for item, menu_item, unit_price, mods, line_total in lines:
        item_res = supabase.table("order_items").insert({
            "business_id": biz,
            "order_id": order_id,
            "menu_item_id": item.menu_item_id,
            "item_name": menu_item["name"],
            # Snapshot, like item_name — distinguishes Hot vs Iced Spanish Latte
            "item_category": (menu_item.get("categories") or {}).get("name"),
            "unit_price": unit_price,
            "quantity": item.quantity,
            "line_total": line_total,
            "notes": item.notes
        }).execute()

        if mods and item_res.data:
            item_id = item_res.data[0]["id"]
            mod_rows = [
                {
                    "business_id": biz,
                    "order_item_id": item_id,
                    "modifier_option_id": o.get("id"),
                    "option_name": o["name"],
                    "price_delta": o["price_delta"]
                }
                for o in mods
            ]
            supabase.table("order_item_modifiers").insert(mod_rows).execute()

    return {"order": order, "order_number": order_number}


def get_order(supabase, business_id: str, order_id: UUID) -> dict:
    res = supabase.table("orders").select("id")\
        .eq("business_id", business_id).eq("id", str(order_id))\
        .is_("deleted_at", None).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="That order no longer exists. Pull down to refresh.")
    return res.data[0]


@router.get("")
def get_orders(status: Optional[str] = None, user: CurrentUser = Depends(require_owner)):
    supabase = get_supabase_admin()

    query = supabase.table("orders")\
        .select("*, order_items(*, order_item_modifiers(*))")\
        .eq("business_id", user.business_id)\
        .is_("deleted_at", None)\
        .order("created_at", desc=True)

    if status:
        query = query.eq("status", status)

    res = query.execute()
    return res.data


@router.patch("/{order_id}/status")
def update_order_status(order_id: UUID, body: UpdateOrderStatusRequest,
                              user: CurrentUser = Depends(require_owner)):
    valid = ["pending", "brewing", "ready", "picked_up", "cancelled"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    supabase = get_supabase_admin()
    order = get_order(supabase, user.business_id, order_id)
    res = supabase.table("orders")\
        .update({"status": body.status})\
        .eq("id", order["id"])\
        .eq("business_id", user.business_id)\
        .execute()

    return res.data


@router.patch("/{order_id}/payment")
def mark_paid(order_id: UUID, user: CurrentUser = Depends(require_owner)):
    supabase = get_supabase_admin()
    order = get_order(supabase, user.business_id, order_id)
    res = supabase.table("orders")\
        .update({"payment_status": "paid"})\
        .eq("id", order["id"])\
        .eq("business_id", user.business_id)\
        .execute()
    return res.data
