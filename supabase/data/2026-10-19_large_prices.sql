-- ============================================================
-- ONE-OFF DATA SCRIPT — Glimpse of Del's 23 Large prices
-- Production only. Run ONCE, AFTER migrations/006_menu_item_large_price.sql.
-- RUN on production (ap-southeast-1) 2026-10-20.
-- ============================================================
--
-- This is not a migration and not part of a rebuild. It sets her prices on
-- her live menu, from her printed menu (2026-10-19). A rebuilt database has
-- no menu to set them on; when a menu seed exists, large_price belongs in
-- it as ordinary item data (see Known design debt in CLAUDE.md).
--
-- Each row names the category, the item, the Medium it expects (base_price)
-- and the Large to set. If any drink is missing, is duplicated, or has a
-- different Medium than her menu, the whole script stops and nothing is
-- applied. Afterwards exactly these 23 items, and no others, have a Large.
-- ============================================================

BEGIN;

DO $$
DECLARE
  glimpse  constant uuid := 'a0000000-0000-0000-0000-000000000001';
  r        RECORD;
  n        integer;
  total    integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('Iced Coffee',  'Spanish Latte',          120, 135),
      ('Iced Coffee',  'Sweet Americano',        100, 120),
      ('Iced Coffee',  'Vietnamese Coffee',      120, 135),
      ('Iced Coffee',  'Dalgona',                100, 120),
      ('Iced Coffee',  'Caramel Dalgona',        120, 135),
      ('Iced Coffee',  'White Chocolate Latte',  135, 150),
      ('Iced Coffee',  'Mocha Latte',            120, 135),
      ('Iced Coffee',  'Caramel Macchiato',      135, 150),
      ('Iced Coffee',  'Oreo Latte',             145, 160),
      ('Iced Coffee',  'Milo Dino Latte',        145, 160),
      ('Iced Coffee',  'Salted Caramel Latte',   120, 140),
      ('Iced Coffee',  'Biscoff Latte',          135, 160),
      ('Non-Coffee',   'Matcha Latte',           120, 140),
      ('Non-Coffee',   'Strawberry Matcha',      145, 160),
      ('Italian Soda', 'Blueberry',               70,  85),
      ('Italian Soda', 'Raspberry',               70,  85),
      ('Italian Soda', 'Green Apple',             70,  85),
      ('Italian Soda', 'Watermelon',              70,  85),
      ('Italian Soda', 'Peach',                   70,  85),
      ('Italian Soda', 'Lychee',                  70,  85),
      ('Italian Soda', 'Strawberry',              70,  85),
      ('Italian Soda', 'Peach Mango',             70,  85),
      ('Italian Soda', 'Melon',                   70,  85)
    ) AS v(category, item, medium, large)
  LOOP
    UPDATE menu_items mi
       SET large_price = r.large
      FROM categories c
     WHERE c.business_id = glimpse
       AND c.id = mi.category_id
       AND c.name = r.category
       AND c.deleted_at IS NULL
       AND mi.business_id = glimpse
       AND mi.name = r.item
       AND mi.deleted_at IS NULL
       AND mi.base_price = r.medium;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN
      RAISE EXCEPTION 'large prices: % / % (Medium ₱%) matched % rows, expected 1. Nothing applied.',
        r.category, r.item, r.medium, n;
    END IF;
    total := total + 1;
  END LOOP;

  -- Nothing else may have a Large: exactly these 23.
  SELECT count(*) INTO n FROM menu_items
   WHERE business_id = glimpse AND large_price IS NOT NULL;
  IF n <> 23 OR total <> 23 THEN
    RAISE EXCEPTION 'large prices: % items have a Large price, expected 23. Nothing applied.', n;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
--   SELECT c.name, mi.name, mi.base_price, mi.large_price
--   FROM menu_items mi JOIN categories c ON c.id = mi.category_id
--   WHERE mi.large_price IS NOT NULL AND mi.deleted_at IS NULL
--   ORDER BY c.name, mi.name;
--   -- Expect: the 23 rows above, and no others.
--
-- If it stopped with "column large_price does not exist": 006 hasn't been
-- applied. Run it first.
--
-- If it stopped on a drink: nothing was applied (one transaction). The
-- message names the drink. Either the name differs from her menu, the
-- Medium has been repriced since 2026-10-19, or the drink was deleted.
-- Check it against her printed menu, fix the VALUES row, and run again.
--
-- Re-running is safe while she hasn't edited a Large herself: it sets the
-- same values. Once she has, don't run it again: it would overwrite her
-- prices with these.
-- ============================================================
