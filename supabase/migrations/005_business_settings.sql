-- ============================================================
-- 005 — per-business settings (Messenger payment request)
-- Applied to the Glimpse of Del Supabase project on 2026-10-12. The first
-- run stopped at STEP 2 (orders_payment_method_check allowed cash, gcash,
-- card, pending); the constraint was widened by hand, then 005 ran. STEP 2
-- below now does that widening itself, so a fresh database gets the same
-- result in one run. Verified: businesses.settings is jsonb.
-- Apply BEFORE deploying the backend with GET/PATCH /settings.
-- ============================================================
--
-- The order screen's "Copy message" fills a payment request from the cart:
-- the items, the real total from the menu, the pickup time and her GCash
-- and Maya numbers. She sends it mid-thread, before the customer pays, so
-- it has to be in her own words and editable by her without asking anyone.
-- It lives here:
--
--   settings = {
--     "messenger_template": "<text with {items} {total} … placeholders>",
--     "gcash_number": "0917 …",
--     "maya_number":  "0917 …"
--   }
--
-- jsonb rather than columns: these are one business's preferences, read and
-- written whole by one screen, and more will join them (receipt header in
-- Phase 2). A key that is absent means "use the default" — the default
-- template lives in the backend (app/routers/settings.py), so improving it
-- reaches every business that hasn't customised theirs.
--
-- NOT NULL DEFAULT '{}' so every existing and future business has an
-- object to read, never NULL.
--
-- Also: Maya joins Cash, GCash and Card as a payment method. The original
-- schema (which predates this folder) has orders_payment_method_check
-- allowing cash, gcash, card and pending. STEP 2 replaces it with the same
-- list plus maya.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — settings
-- ------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN businesses.settings IS
  'Per-business preferences: messenger_template, gcash_number, maya_number. Absent key = backend default.';

-- ------------------------------------------------------------
-- STEP 2 — payment_method accepts 'maya'
-- ------------------------------------------------------------
-- Every value the original constraint allowed, plus maya. 'pending' is never
-- sent by the current app but was allowed, so it stays allowed. ADD
-- CONSTRAINT validates existing rows: if a database holds a value not in
-- this list, it fails here and nothing in 005 is applied, rather than the
-- value being silently disallowed.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method = ANY (ARRAY['cash'::text, 'gcash'::text, 'maya'::text, 'card'::text, 'pending'::text]));

-- Guard: any OTHER check constraint on payment_method (a differently named
-- one in some other database) that still lacks maya would reject Maya
-- orders. Stop and print it rather than guess at its values.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.conrelid = 'public.orders'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%payment_method%'
  LOOP
    IF r.def NOT ILIKE '%maya%' THEN
      RAISE EXCEPTION 'orders has CHECK constraint % on payment_method that does not allow maya: %. Widen it by hand (keeping every existing value), then re-run 005.', r.conname, r.def;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'businesses'
--     AND column_name = 'settings';
--   -- Expect: settings | jsonb | NO | '{}'::jsonb
--
--   SELECT id, settings FROM businesses;
--   -- Expect: {} for every business.
--
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'orders_payment_method_check';
--   -- Expect: CHECK ((payment_method = ANY (ARRAY['cash'::text,
--   --   'gcash'::text, 'maya'::text, 'card'::text, 'pending'::text])))
--
-- If STEP 2 failed: nothing was applied (one transaction).
--   * "violates check constraint": some order has a payment_method outside
--     the list. Find it (SELECT DISTINCT payment_method FROM orders), add
--     that value to the ARRAY above, run again.
--   * The guard raised: another constraint names payment_method; widen it
--     by hand keeping every value it allows, plus 'maya', and run again.
--
-- Re-running 005 is safe: every step is IF NOT EXISTS / IF EXISTS.
--
-- PostgREST caches the schema. If the API still rejects settings right
-- after this runs, reload it:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================
