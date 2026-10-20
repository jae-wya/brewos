"""Menu management: create, edit, soft-delete and restore items and categories.

Same rule as order pricing: the server validates, the client asserts
nothing it shouldn't. business_id comes only from the token. Every id in a
request is checked as belonging to this business before anything is
written. The client never sets business_id, sort_order, is_available,
deleted_at or timestamps — unknown fields are ignored.

Duplicate names are enforced by the unique indexes from migration 001, not
by a pre-check: a 23505 from Postgres is turned into a sentence for her.
Every `detail` here is written to be shown to her as-is.
"""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel, field_validator

from app.database import get_supabase_admin
from app.security import CurrentUser, require_owner

router = APIRouter()

NAME_MAX = 60
PRICE_MAX = Decimal("99999")


# --- Validation ---
def clean_name(v) -> str:
    if not isinstance(v, str):
        raise ValueError("Name must be text.")
    name = " ".join(v.split())
    if not name:
        raise ValueError("Name can't be empty.")
    if len(name) > NAME_MAX:
        raise ValueError(f"Name can be at most {NAME_MAX} characters.")
    return name


def clean_price(v, label: str = "Price") -> Decimal:
    try:
        price = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        raise ValueError(f"{label} must be a number.")
    if not price.is_finite():
        raise ValueError(f"{label} must be a number.")
    # ₱0 is allowed on purpose: free water, staff drinks, promo items.
    if price < 0:
        raise ValueError(f"{label} can't be negative.")
    if price > PRICE_MAX:
        raise ValueError(f"{label} can be at most ₱{PRICE_MAX:,}.")
    if price != price.quantize(Decimal("0.01")):
        raise ValueError(f"{label} can have at most 2 decimal places.")
    return price


class CreateItemRequest(BaseModel):
    name: str
    category_id: UUID
    base_price: Decimal
    # None = one size only. Set = base_price is the Medium (migration 006).
    large_price: Optional[Decimal] = None
    modifier_ids: List[UUID] = []

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v):
        return clean_name(v)

    @field_validator("base_price", mode="before")
    @classmethod
    def validate_price(cls, v):
        return clean_price(v)

    @field_validator("large_price", mode="before")
    @classmethod
    def validate_large_price(cls, v):
        return None if v is None else clean_price(v, "Large price")


class UpdateItemRequest(BaseModel):
    name: Optional[str] = None
    category_id: Optional[UUID] = None
    base_price: Optional[Decimal] = None
    # When present, REPLACES the Large price; null removes it (one size only).
    large_price: Optional[Decimal] = None
    # When present, REPLACES the item's add-on groups (empty list = none).
    modifier_ids: Optional[List[UUID]] = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v):
        return None if v is None else clean_name(v)

    @field_validator("base_price", mode="before")
    @classmethod
    def validate_price(cls, v):
        return None if v is None else clean_price(v)

    @field_validator("large_price", mode="before")
    @classmethod
    def validate_large_price(cls, v):
        return None if v is None else clean_price(v, "Large price")


class CategoryRequest(BaseModel):
    name: str

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, v):
        return clean_name(v)


class CategoryOrderRequest(BaseModel):
    ids: List[UUID]


# --- Helpers ---
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_unique_violation(e: APIError, index: str) -> bool:
    return e.code == "23505" and index in (e.message or "")


def a_or_an(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def duplicate_item_message(category_name: str, item_name: str) -> str:
    # Item first, category second: reads right for plural category names too
    # ("There's already a Fries in Snacks.").
    return f"There's already {a_or_an(item_name)} {item_name} in {category_name}."


def peso(amount) -> str:
    s = f"{Decimal(str(amount)):,.2f}"
    return "₱" + (s[:-3] if s.endswith(".00") else s)


def check_large_price(base_price, large_price):
    """Said in a sentence before menu_items_large_price_check (migration 006)
    would refuse it. Also catches raising a Medium past its Large."""
    if large_price is not None and Decimal(str(large_price)) <= Decimal(str(base_price)):
        raise HTTPException(status_code=422, detail=large_price_message(base_price, large_price))


def large_price_message(base_price, large_price) -> str:
    return f"Large ({peso(large_price)}) must be more than the Medium ({peso(base_price)})."


def is_large_price_violation(e: APIError) -> bool:
    return e.code == "23514" and "menu_items_large_price_check" in (e.message or "")


def get_live_category(sb, business_id: str, category_id) -> dict:
    res = sb.table("categories").select("id, name, sort_order")\
        .eq("business_id", business_id).eq("id", str(category_id))\
        .is_("deleted_at", None).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="That category no longer exists. Pull down to refresh.")
    return res.data[0]


def get_item(sb, business_id: str, item_id, deleted: bool = False) -> dict:
    q = sb.table("menu_items").select("*")\
        .eq("business_id", business_id).eq("id", str(item_id))
    q = q.not_.is_("deleted_at", "null") if deleted else q.is_("deleted_at", None)
    res = q.limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="That item no longer exists. Pull down to refresh.")
    return res.data[0]


def check_modifiers(sb, business_id: str, modifier_ids) -> List[str]:
    ids = list(dict.fromkeys(str(m) for m in modifier_ids))  # de-dupe, keep order
    if not ids:
        return []
    res = sb.table("modifiers").select("id")\
        .eq("business_id", business_id).in_("id", ids)\
        .is_("deleted_at", None).execute()
    if len(res.data) != len(ids):
        raise HTTPException(status_code=404, detail="One of those add-on groups no longer exists. Pull down to refresh.")
    return ids


def next_sort_order(sb, table: str, business_id: str, category_id: Optional[str] = None) -> int:
    q = sb.table(table).select("sort_order").eq("business_id", business_id).is_("deleted_at", None)
    if category_id is not None:
        q = q.eq("category_id", category_id)
    res = q.order("sort_order", desc=True).limit(1).execute()
    return (res.data[0]["sort_order"] + 1) if res.data else 1


def item_response(sb, business_id: str, item_id: str) -> dict:
    """Same shape as an item in GET /menu."""
    res = sb.table("menu_items").select("*, menu_item_modifiers(modifier_id)")\
        .eq("business_id", business_id).eq("id", item_id).limit(1).execute()
    return res.data[0]


def set_item_modifiers(sb, business_id: str, item_id: str, wanted: List[str]):
    current = {r["modifier_id"] for r in sb.table("menu_item_modifiers").select("modifier_id")
               .eq("business_id", business_id).eq("menu_item_id", item_id).execute().data}
    to_add = [m for m in wanted if m not in current]
    to_remove = [m for m in current if m not in set(wanted)]
    # Add before removing: if the second call fails, the item keeps a
    # superset of add-ons rather than silently losing one.
    if to_add:
        sb.table("menu_item_modifiers").insert([
            {"business_id": business_id, "menu_item_id": item_id, "modifier_id": m} for m in to_add
        ]).execute()
    if to_remove:
        sb.table("menu_item_modifiers").delete()\
            .eq("business_id", business_id).eq("menu_item_id", item_id)\
            .in_("modifier_id", to_remove).execute()


# --- Items ---
@router.post("/items", status_code=201)
def create_item(body: CreateItemRequest, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    biz = user.business_id
    check_large_price(body.base_price, body.large_price)
    category = get_live_category(sb, biz, body.category_id)
    modifier_ids = check_modifiers(sb, biz, body.modifier_ids)

    try:
        res = sb.table("menu_items").insert({
            "business_id": biz,
            "category_id": category["id"],
            "name": body.name,
            "base_price": float(body.base_price),
            "large_price": None if body.large_price is None else float(body.large_price),
            "sort_order": next_sort_order(sb, "menu_items", biz, category["id"]),
        }).execute()
    except APIError as e:
        if is_unique_violation(e, "menu_items_biz_cat_name_uq"):
            raise HTTPException(status_code=409, detail=duplicate_item_message(category["name"], body.name))
        if is_large_price_violation(e):
            raise HTTPException(status_code=422, detail=large_price_message(body.base_price, body.large_price))
        raise

    item_id = res.data[0]["id"]
    try:
        set_item_modifiers(sb, biz, item_id, modifier_ids)
    except Exception:
        # No transactions over REST. A brand-new item has no orders, so
        # removing it outright leaves nothing half-created.
        sb.table("menu_items").delete().eq("business_id", biz).eq("id", item_id).execute()
        raise
    return item_response(sb, biz, item_id)


@router.patch("/items/{item_id}")
def update_item(item_id: UUID, body: UpdateItemRequest, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    biz = user.business_id
    fields = body.model_fields_set
    if not fields:
        raise HTTPException(status_code=422, detail="Nothing to change.")

    item = get_item(sb, biz, item_id)
    changes = {}

    if "name" in fields and body.name is not None:
        changes["name"] = body.name
    if "base_price" in fields and body.base_price is not None:
        changes["base_price"] = float(body.base_price)
    if "large_price" in fields:
        changes["large_price"] = None if body.large_price is None else float(body.large_price)
    # Against what the item will be after this edit: a new Medium alone can
    # pass its existing Large.
    base_after = changes.get("base_price", item["base_price"])
    large_after = changes.get("large_price", item["large_price"])
    check_large_price(base_after, large_after)

    category_id = item["category_id"]
    if "category_id" in fields and body.category_id is not None and str(body.category_id) != category_id:
        category_id = get_live_category(sb, biz, body.category_id)["id"]
        changes["category_id"] = category_id
        changes["sort_order"] = next_sort_order(sb, "menu_items", biz, category_id)

    modifier_ids = check_modifiers(sb, biz, body.modifier_ids) if body.modifier_ids is not None else None

    if changes:
        changes["updated_at"] = now_iso()
        try:
            sb.table("menu_items").update(changes)\
                .eq("business_id", biz).eq("id", item["id"]).execute()
        except APIError as e:
            if is_unique_violation(e, "menu_items_biz_cat_name_uq"):
                cat = get_live_category(sb, biz, category_id)
                raise HTTPException(status_code=409, detail=duplicate_item_message(cat["name"], changes.get("name", item["name"])))
            if is_large_price_violation(e):
                # check_large_price passed, so the item changed since we read it.
                raise HTTPException(status_code=422, detail="Large must be more than the Medium. Pull down to refresh, then try again.")
            raise

    if modifier_ids is not None:
        set_item_modifiers(sb, biz, item["id"], modifier_ids)

    return item_response(sb, biz, item["id"])


@router.delete("/items/{item_id}")
def delete_item(item_id: UUID, user: CurrentUser = Depends(require_owner)):
    """Soft delete. Past orders keep their snapshot (item_name, unit_price,
    item_category), and the add-on links are kept so restore brings them back."""
    sb = get_supabase_admin()
    item = get_item(sb, user.business_id, item_id)
    deleted_at = now_iso()
    sb.table("menu_items").update({"deleted_at": deleted_at, "updated_at": deleted_at})\
        .eq("business_id", user.business_id).eq("id", item["id"]).execute()
    return {"id": item["id"], "deleted_at": deleted_at}


@router.post("/items/{item_id}/restore")
def restore_item(item_id: UUID, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    biz = user.business_id
    item = get_item(sb, biz, item_id, deleted=True)

    # Never restore into a deleted category: the item would be orderable but
    # invisible on every screen.
    cat_res = sb.table("categories").select("id, name, deleted_at")\
        .eq("business_id", biz).eq("id", item["category_id"]).limit(1).execute() \
        if item["category_id"] else None
    if not cat_res or not cat_res.data or cat_res.data[0]["deleted_at"] is not None:
        cat_name = cat_res.data[0]["name"] if cat_res and cat_res.data else "its category"
        raise HTTPException(status_code=409, detail=f"{item['name']} was in {cat_name}, which has been deleted. Restore the category first.")
    cat = cat_res.data[0]

    try:
        sb.table("menu_items").update({"deleted_at": None, "updated_at": now_iso()})\
            .eq("business_id", biz).eq("id", item["id"]).execute()
    except APIError as e:
        if is_unique_violation(e, "menu_items_biz_cat_name_uq"):
            raise HTTPException(status_code=409, detail=f"You've since added another {item['name']} to {cat['name']}. Rename one first.")
        raise
    return item_response(sb, biz, item["id"])


# --- Categories ---
def get_category(sb, business_id: str, category_id, deleted: bool = False) -> dict:
    q = sb.table("categories").select("*").eq("business_id", business_id).eq("id", str(category_id))
    q = q.not_.is_("deleted_at", "null") if deleted else q.is_("deleted_at", None)
    res = q.limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="That category no longer exists. Pull down to refresh.")
    return res.data[0]


def duplicate_category_message(name: str) -> str:
    return f"You already have a category called {name}."


@router.post("/categories", status_code=201)
def create_category(body: CategoryRequest, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    try:
        res = sb.table("categories").insert({
            "business_id": user.business_id,
            "name": body.name,
            "sort_order": next_sort_order(sb, "categories", user.business_id),
        }).execute()
    except APIError as e:
        if is_unique_violation(e, "categories_biz_name_uq"):
            raise HTTPException(status_code=409, detail=duplicate_category_message(body.name))
        raise
    return res.data[0]


# Registered before /categories/{category_id} so "order" is never read as an id.
@router.put("/categories/order")
def reorder_categories(body: CategoryOrderRequest, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    biz = user.business_id
    live = sb.table("categories").select("id, sort_order")\
        .eq("business_id", biz).is_("deleted_at", None).execute().data
    wanted = [str(i) for i in body.ids]
    if len(wanted) != len(set(wanted)) or set(wanted) != {c["id"] for c in live}:
        raise HTTPException(status_code=409, detail="Your category list is out of date. Pull down to refresh, then try again.")

    current = {c["id"]: c["sort_order"] for c in live}
    stamp = now_iso()
    for position, cat_id in enumerate(wanted, start=1):
        if current[cat_id] != position:
            sb.table("categories").update({"sort_order": position, "updated_at": stamp})\
                .eq("business_id", biz).eq("id", cat_id).execute()

    return sb.table("categories").select("*").eq("business_id", biz)\
        .is_("deleted_at", None).order("sort_order").execute().data


@router.patch("/categories/{category_id}")
def rename_category(category_id: UUID, body: CategoryRequest, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    cat = get_category(sb, user.business_id, category_id)
    try:
        res = sb.table("categories").update({"name": body.name, "updated_at": now_iso()})\
            .eq("business_id", user.business_id).eq("id", cat["id"]).execute()
    except APIError as e:
        if is_unique_violation(e, "categories_biz_name_uq"):
            raise HTTPException(status_code=409, detail=duplicate_category_message(body.name))
        raise
    return res.data[0]


@router.delete("/categories/{category_id}")
def delete_category(category_id: UUID, user: CurrentUser = Depends(require_owner)):
    """Soft delete, only when empty. Deleting a category with live items would
    hide them from every screen while they stayed orderable."""
    sb = get_supabase_admin()
    biz = user.business_id
    cat = get_category(sb, biz, category_id)
    count = sb.table("menu_items").select("id", count="exact")\
        .eq("business_id", biz).eq("category_id", cat["id"])\
        .is_("deleted_at", None).limit(1).execute().count or 0
    if count:
        noun = "item" if count == 1 else "items"
        raise HTTPException(status_code=409, detail=f"{cat['name']} still has {count} {noun}. Move or delete them first.")

    deleted_at = now_iso()
    sb.table("categories").update({"deleted_at": deleted_at, "updated_at": deleted_at})\
        .eq("business_id", biz).eq("id", cat["id"]).execute()
    return {"id": cat["id"], "deleted_at": deleted_at}


@router.post("/categories/{category_id}/restore")
def restore_category(category_id: UUID, user: CurrentUser = Depends(require_owner)):
    sb = get_supabase_admin()
    biz = user.business_id
    cat = get_category(sb, biz, category_id, deleted=True)
    try:
        res = sb.table("categories").update({
            "deleted_at": None,
            "sort_order": next_sort_order(sb, "categories", biz),
            "updated_at": now_iso(),
        }).eq("business_id", biz).eq("id", cat["id"]).execute()
    except APIError as e:
        if is_unique_violation(e, "categories_biz_name_uq"):
            raise HTTPException(status_code=409, detail=f"You've since added another category called {cat['name']}. Rename one first.")
        raise
    return res.data[0]
