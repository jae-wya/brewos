-- ============================================================
-- ONE-OFF DATA SCRIPT — retire the Size add-on group
-- Production only. Run ONCE, AFTER 2026-10-19_large_prices.sql, and
-- right BEFORE pushing the backend + frontend that read large_price.
-- RUN on production (ap-southeast-1) 2026-10-20.
-- ============================================================
--
-- Size ("Medium (M)" +₱0, "Large (L)" +₱15) is replaced by
-- menu_items.large_price (migration 006). This takes it off the menu.
--
-- Run it before the push, not after. Between this script and the deploy,
-- the old app can't sell a Large at all: the group is gone from its menu.
-- The other order would leave a window where the new app shows Size next to
-- its own M/L picker and a Large is charged an extra ₱15. Not being able to
-- sell is the better failure.
--
-- Three changes, all or nothing:
--
--   1. The group is soft-deleted. GET /menu stops returning it, and the new
--      backend refuses any option from a deleted group.
--
--   2. Its two options are turned off (is_available = false). Options have
--      no deleted_at, so this is the nearest thing. It matters while the OLD
--      backend is still live: that one doesn't check the group, but it does
--      refuse an option that's off, so a phone with the old menu still open
--      can't order "Large (L) +₱15".
--
--   3. The 26 links from items to Size are deleted (23 live drinks and 3
--      Nescafe rows deleted on 2026-10-12). Left in place, the item form
--      would send Size's id back with every save of those drinks, and the
--      backend refuses a deleted group, so she couldn't edit them. The links
--      carry no history: past orders keep their own snapshot
--      (order_item_modifiers.option_name and price_delta), and large_price
--      now says which drinks come in two sizes.
--
-- Checked first: the group is live and is the one expected, it still has
-- exactly its two options, and every live drink linked to it has a Large
-- price. A drink with Size but no Large would quietly become one-size, so
-- that stops the script.
-- ============================================================

BEGIN;

DO $$
DECLARE
  glimpse  constant uuid := 'a0000000-0000-0000-0000-000000000001';
  size_id  constant uuid := '00000000-0000-0000-0020-000000000001';
  n        integer;
BEGIN
  -- The group: live, named Size, Glimpse's.
  SELECT count(*) INTO n FROM modifiers
   WHERE business_id = glimpse AND id = size_id AND name = 'Size' AND deleted_at IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'retire size: no live Size group with the expected id (already retired?). Nothing applied.';
  END IF;

  -- Its options: exactly Medium (M) and Large (L).
  SELECT count(*) INTO n FROM modifier_options
   WHERE business_id = glimpse AND modifier_id = size_id
     AND name IN ('Medium (M)', 'Large (L)');
  IF n <> 2 OR (SELECT count(*) FROM modifier_options
                 WHERE business_id = glimpse AND modifier_id = size_id) <> 2 THEN
    RAISE EXCEPTION 'retire size: Size should have exactly Medium (M) and Large (L). Nothing applied.';
  END IF;

  -- Every live drink with Size has a Large price, and there are 23 of them.
  SELECT count(*) INTO n
    FROM menu_item_modifiers l JOIN menu_items mi
      ON mi.business_id = l.business_id AND mi.id = l.menu_item_id
   WHERE l.business_id = glimpse AND l.modifier_id = size_id
     AND mi.deleted_at IS NULL AND mi.large_price IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'retire size: % live item(s) have Size but no Large price. Nothing applied.', n;
  END IF;
  SELECT count(*) INTO n
    FROM menu_item_modifiers l JOIN menu_items mi
      ON mi.business_id = l.business_id AND mi.id = l.menu_item_id
   WHERE l.business_id = glimpse AND l.modifier_id = size_id AND mi.deleted_at IS NULL;
  IF n <> 23 THEN
    RAISE EXCEPTION 'retire size: % live items linked to Size, expected 23. Nothing applied.', n;
  END IF;

  -- 1. The group.
  UPDATE modifiers SET deleted_at = now(), updated_at = now()
   WHERE business_id = glimpse AND id = size_id;

  -- 2. Its options.
  UPDATE modifier_options SET is_available = false, updated_at = now()
   WHERE business_id = glimpse AND modifier_id = size_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN
    RAISE EXCEPTION 'retire size: turned off % options, expected 2. Nothing applied.', n;
  END IF;

  -- 3. The links.
  DELETE FROM menu_item_modifiers
   WHERE business_id = glimpse AND modifier_id = size_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 26 THEN
    RAISE EXCEPTION 'retire size: removed % links, expected 26. Nothing applied.', n;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT name, deleted_at FROM modifiers
--   WHERE id = '00000000-0000-0000-0020-000000000001';
--   -- Expect: Size | (a timestamp)
--
--   SELECT name, is_available FROM modifier_options
--   WHERE modifier_id = '00000000-0000-0000-0020-000000000001';
--   -- Expect: Medium (M) | false, Large (L) | false
--
--   SELECT count(*) FROM menu_item_modifiers
--   WHERE modifier_id = '00000000-0000-0000-0020-000000000001';
--   -- Expect: 0
--
-- If it stopped: nothing was applied (one transaction), and the message
-- says which check failed. Don't push until it has run.
--
-- Not re-runnable: once the group is deleted, the first check stops it.
-- That is the intent; there is nothing left for a second run to do.
--
-- To undo (before the push only; after it the app no longer reads Size):
--   UPDATE modifiers SET deleted_at = NULL WHERE id = '00000000-0000-0000-0020-000000000001';
--   UPDATE modifier_options SET is_available = true
--    WHERE modifier_id = '00000000-0000-0000-0020-000000000001';
--   -- and re-link the 23 drinks: every live item with a large_price.
--   INSERT INTO menu_item_modifiers (business_id, menu_item_id, modifier_id)
--   SELECT business_id, id, '00000000-0000-0000-0020-000000000001'
--   FROM menu_items
--   WHERE business_id = 'a0000000-0000-0000-0000-000000000001'
--     AND large_price IS NOT NULL AND deleted_at IS NULL;
-- ============================================================
