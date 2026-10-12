-- ============================================================
-- 004 — record when an order was paid
-- NOT YET APPLIED. Apply to the Glimpse of Del Supabase project BEFORE
-- deploying the backend with GET /sales, which reads orders.paid_at.
-- ============================================================
--
-- Payment, not pickup, is the sale event. Her Messenger orders are paid
-- before the drink is made (GCash proof, she confirms, then she makes it),
-- so a drink paid Monday and collected Tuesday is a Monday sale. Daily sales
-- (GET /sales) therefore put each order on the Asia/Manila day of paid_at.
-- Until now the schema recorded THAT an order was paid (payment_status),
-- never WHEN.
--
-- paid_at is set ONCE, by the trigger below, the first time an order
-- becomes paid — whether it is created paid ("Paid now" in the cart) or
-- marked paid later. After that it never changes: an update that tries to
-- move or clear it keeps the original value, and an order that goes paid ->
-- unpaid -> paid keeps its first timestamp. Moving it forward would move the
-- sale to a different day.
--
-- It is a trigger rather than application code so it holds for every path
-- that marks an order paid, including ones not written yet (the Messenger
-- composer). The application never writes paid_at itself.
--
-- PRE-FLIGHT: at the time of writing the orders table has 0 rows for Glimpse
-- of Del, so the backfill below should report UPDATE 0.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN orders.paid_at IS
  'When the order first became paid. Set once by orders_paid_at_once; never moved. Daily sales use its Asia/Manila date.';

CREATE OR REPLACE FUNCTION orders_paid_at_once() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT NULL THEN
    NEW.paid_at := OLD.paid_at;              -- set once: never moved, never cleared
  ELSIF NEW.payment_status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, now());
  ELSE
    NEW.paid_at := NULL;                      -- not paid yet: no timestamp
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_paid_at_once ON orders;
CREATE TRIGGER orders_paid_at_once
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_paid_at_once();

-- Any order already paid before this column existed: created_at is the best
-- record of when. Expected to touch 0 rows (see PRE-FLIGHT).
UPDATE orders SET paid_at = created_at
WHERE payment_status = 'paid' AND paid_at IS NULL;

-- For GET /sales: one business, one day of paid_at.
CREATE INDEX IF NOT EXISTS orders_business_paid_at_idx
  ON orders (business_id, paid_at)
  WHERE deleted_at IS NULL;

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'orders'
--     AND column_name = 'paid_at';
--   -- Expect: paid_at | timestamp with time zone | YES
--
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'orders'::regclass AND NOT tgisinternal;
--   -- Expect: orders_paid_at_once
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'orders'
--     AND indexname = 'orders_business_paid_at_idx';
--
-- Set-once check. Run as one block; it ends in ROLLBACK, so nothing is kept.
--   BEGIN;
--   INSERT INTO orders (business_id, order_number, source, subtotal, total_amount,
--                       payment_method, payment_status, status)
--     SELECT id, 'PAIDAT-TEST', 'walk_in', 0, 0, 'cash', 'unpaid', 'pending'
--     FROM businesses LIMIT 1;
--   SELECT paid_at FROM orders WHERE order_number = 'PAIDAT-TEST';  -- NULL
--   UPDATE orders SET payment_status = 'paid'   WHERE order_number = 'PAIDAT-TEST';
--   SELECT paid_at FROM orders WHERE order_number = 'PAIDAT-TEST';  -- set
--   UPDATE orders SET payment_status = 'unpaid' WHERE order_number = 'PAIDAT-TEST';
--   UPDATE orders SET payment_status = 'paid', paid_at = '2000-01-01'
--     WHERE order_number = 'PAIDAT-TEST';
--   SELECT paid_at FROM orders WHERE order_number = 'PAIDAT-TEST';  -- unchanged, not 2000-01-01
--   ROLLBACK;
-- (now() is the transaction's start time, so inside one transaction "set"
-- and "unchanged" print the same value; the 2000-01-01 line is the test.)
--
-- PostgREST caches the schema. If the API still rejects paid_at right after
-- this runs, reload it:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================
