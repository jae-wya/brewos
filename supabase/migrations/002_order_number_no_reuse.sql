-- ============================================================
-- 002 — order numbers are never reused
-- Applied to the Glimpse of Del Supabase project on 2026-10-11,
-- immediately before 001.
-- ============================================================
--
-- The original function excluded soft-deleted rows:
--
--   WHERE business_id = p_business_id
--     AND deleted_at IS NULL        <-- removed
--
-- which meant voiding ORD-0006 handed the same number to the next order.
-- Two different orders under one number, and — once 001 adds the unique
-- index on (business_id, order_number) — a failed insert the next time she
-- places an order after voiding one.
--
-- A voided order's number was already shown to a customer and may be in
-- her own records, so the number is spent either way. Counting every row,
-- deleted or not, is both the safer and the more honest behaviour.
--
-- Unchanged from the original: scoping by p_business_id (correct — each
-- café numbers independently), and no daily reset (so no date arithmetic
-- and no timezone exposure).
--
-- KNOWN LIMITATION — MAX + 1 is not atomic. Two orders submitted in the
-- same instant both read the same maximum and generate the same number.
-- Before 001 that silently created duplicates; after 001 the second insert
-- fails with a unique violation, which is the safer failure. The route
-- layer handles this by retrying on 23505. A sequence per business would
-- remove the race entirely but would also leave gaps on any rolled-back
-- transaction, which is worse for a café's paper trail.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_order_number(p_business_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq_val BIGINT;
BEGIN
  -- Soft-deleted orders still count toward the sequence.
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 5) AS BIGINT)
  ), 0) + 1
  INTO seq_val
  FROM orders
  WHERE business_id = p_business_id;

  RETURN 'ORD-' || LPAD(seq_val::TEXT, 4, '0');
END;
$function$;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT pg_get_functiondef(p.oid)
--   FROM pg_proc p WHERE p.proname = 'generate_order_number';
--
-- The returned body must have no "deleted_at IS NULL" condition.
--
-- NOTE ON DATA STATE: the six development orders (ORD-0001 … ORD-0006,
-- Sep 16 – Oct 3) were hard-deleted on 2026-10-11 along with their
-- order_items and order_item_modifiers rows, so the next real order is
-- ORD-0001. Two of them (ORD-0005, ORD-0006) carried the add-on
-- double-charge bug and were ₱15 over; they were test data, not her books,
-- so they were removed rather than corrected.
-- ============================================================
