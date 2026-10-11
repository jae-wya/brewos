-- ============================================================
-- 003 — snapshot the category onto each order line
-- Applied to the Glimpse of Del Supabase project on 2026-10-12, before the
-- backend that writes item_category was deployed. Verified:
-- item_category | text | YES, and the PostgREST schema cache was reloaded.
-- On a fresh database, apply this BEFORE that backend or every order insert
-- fails on an unknown column.
-- ============================================================
--
-- Glimpse of Del's menu carries six drinks in both Hot Coffee and Iced
-- Coffee at different prices (Spanish Latte ₱135 hot / ₱120 iced, and five
-- others — see 001). order_items only stored item_name, so the queue showed
-- "1× Spanish Latte" with no way to tell which one to make.
--
-- item_category is a SNAPSHOT of categories.name at the moment the order is
-- placed, exactly like item_name and unit_price. It is set once by
-- create_order and never recomputed: if she later renames "Iced Coffee" or
-- moves a drink, past orders keep the category they were sold under. Do not
-- derive it by joining menu_items -> categories at read time — menu_item_id
-- goes NULL when an item is deleted, and the live category may have changed.
--
-- Nullable on purpose:
--   * no backfill — at the time of writing order_items has 0 rows (the
--     development orders were deleted, see 002), so nothing is missing;
--   * a future order line with no category (e.g. a custom item) stays valid.
--
-- text, matching item_name and categories.name.
-- ============================================================

BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_category text;

COMMENT ON COLUMN order_items.item_category IS
  'Snapshot of categories.name when the order was placed. Never recomputed from the live menu.';

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'order_items'
--     AND column_name = 'item_category';
--
-- Expect: item_category | text | YES
--
-- PostgREST caches the schema. If the API still rejects item_category right
-- after this runs, reload it:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================
