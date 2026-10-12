-- ============================================================
-- 005 — per-business settings (Messenger payment request)
-- NOT YET APPLIED. Apply to the Glimpse of Del Supabase project BEFORE
-- deploying the backend with GET/PATCH /settings, which reads and writes
-- businesses.settings.
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
-- schema predates this folder, so whether orders.payment_method has a CHECK
-- constraint isn't recorded anywhere. STEP 2 looks: if there is one, it
-- stops the migration and prints the constraint, so it can be widened by
-- hand with the full list of values rather than guessed at here.
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
-- STEP 2 — make sure payment_method accepts 'maya'
-- ------------------------------------------------------------
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
-- If STEP 2 raised: nothing was applied (one transaction). Widen the
-- constraint, e.g.
--   ALTER TABLE orders DROP CONSTRAINT <name>;
--   ALTER TABLE orders ADD CONSTRAINT <name>
--     CHECK (payment_method IN (<every existing value>, 'maya'));
-- and run 005 again.
--
-- PostgREST caches the schema. If the API still rejects settings right
-- after this runs, reload it:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================
