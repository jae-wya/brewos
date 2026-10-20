-- ============================================================
-- 006 — a Large price on the item, replacing the shared Size add-on
-- APPLIED to production (ap-southeast-1) 2026-10-20, before deploying the
-- backend that reads menu_items.large_price.
-- ============================================================
--
-- Size was one add-on group, "Large (L) +₱15", linked to 23 drinks. Her
-- printed menu has three different M→L steps (+₱15, +₱20, +₱25), so five
-- drinks undercharged on every Large. And she couldn't fix it herself: there
-- is no screen for add-on prices.
--
-- Size isn't really an add-on. It is a second price on the item, and her
-- printed menu lists it that way ("Biscoff Latte 135 / 160"). So:
--
--   large_price NULL      the item comes in one size (base_price)
--   large_price set       Medium = base_price, Large = large_price
--
-- She edits it in the item form next to the price. The two prices are
-- independent: raising a Medium does NOT move its Large. That is correct:
-- her real steps differ by drink, and that difference was the bug.
--
-- Past orders are untouched. create_order still snapshots the size as an
-- order_item_modifiers row ("Large (L)", price_delta = large_price −
-- base_price at the moment of sale), the same row it wrote before 006.
--
-- CHECK large_price > base_price: a Large at or below the Medium is a typo.
-- The backend checks it first and says so in a sentence. The constraint is
-- the backstop.
--
-- SCHEMA ONLY. Every item starts with large_price NULL. Her 23 Large prices
-- are data, not schema: they are set by a one-off script run on production
-- after this one, supabase/data/2026-10-19_large_prices.sql. Migrations
-- change schema; data scripts change data. Mixing the two is why 001–005
-- couldn't rebuild the database.
--
-- The Size group itself is retired separately, after the app no longer
-- reads it (step 5 of the change). Not here.
-- ============================================================

BEGIN;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS large_price numeric(10,2);

ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_large_price_check;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_large_price_check
  CHECK (large_price IS NULL OR large_price > base_price);

COMMENT ON COLUMN menu_items.large_price IS
  'Price of a Large. NULL = one size only. Independent of base_price (the Medium).';

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'menu_items'
--     AND column_name = 'large_price';
--   -- Expect: large_price | numeric | 10 | 2 | YES
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'menu_items_large_price_check';
--   -- Expect: CHECK (((large_price IS NULL) OR (large_price > base_price)))
--
-- Re-running 006 is safe: the column is IF NOT EXISTS, and the constraint
-- is dropped and re-added.
--
-- PostgREST caches the schema. If the API doesn't return large_price right
-- after this runs, reload it:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================
