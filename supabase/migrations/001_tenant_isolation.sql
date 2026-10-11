-- ============================================================
-- 001 — tenant isolation hardening
-- Applied to the Glimpse of Del Supabase project on 2026-10-11.
-- Verified: all 11 parent-child foreign keys report 2 key columns, and a
-- cross-tenant insert is rejected with 23503 on menu_items_category_fk.
-- Requires PostgreSQL 15+ (project runs 17.6).
-- ============================================================
--
-- The schema already carried business_id on every table. What it lacked was
-- any guarantee that a row's PARENT belongs to the same business:
--
--   INSERT INTO order_items (business_id, order_id, menu_item_id, ...)
--   VALUES (glimpse_id, glimpse_order_id, other_cafe_menu_item_id, ...);
--
-- was accepted without complaint. Composite foreign keys make that
-- impossible at the database level, so a forgotten WHERE clause in the
-- application can no longer leak or corrupt data across cafés.
--
-- PRE-FLIGHT (all returned clean before this was applied):
--   SHOW server_version;                                    -- 17.6
--   duplicate menu_items names per business                 -- 6 pairs, Hot/Iced
--   duplicate categories names per business                 -- none
--   menu_items whose category belongs to another business   -- none
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — unique (business_id, id) so composite FKs have a target
-- ------------------------------------------------------------
-- id is already each table's primary key, so this constrains no data that
-- wasn't already constrained. Postgres simply requires a unique index on
-- the referenced column pair.
--
-- businesses is deliberately absent: children reference it by business_id
-- alone, and businesses.id is already the primary key.

ALTER TABLE categories       ADD CONSTRAINT categories_biz_id_uq       UNIQUE (business_id, id);
ALTER TABLE menu_items       ADD CONSTRAINT menu_items_biz_id_uq       UNIQUE (business_id, id);
ALTER TABLE modifiers        ADD CONSTRAINT modifiers_biz_id_uq        UNIQUE (business_id, id);
ALTER TABLE modifier_options ADD CONSTRAINT modifier_options_biz_id_uq UNIQUE (business_id, id);
ALTER TABLE orders           ADD CONSTRAINT orders_biz_id_uq           UNIQUE (business_id, id);
ALTER TABLE order_items      ADD CONSTRAINT order_items_biz_id_uq      UNIQUE (business_id, id);
ALTER TABLE inventory_items  ADD CONSTRAINT inventory_items_biz_id_uq  UNIQUE (business_id, id);
ALTER TABLE staff            ADD CONSTRAINT staff_biz_id_uq            UNIQUE (business_id, id);

-- ------------------------------------------------------------
-- STEP 2 — drop the single-column foreign keys
-- ------------------------------------------------------------
-- Constraint names vary with how each table was created, so this looks up
-- every FK touching the named column and drops it by its real name rather
-- than guessing at "<table>_<column>_fkey".

DO $$
DECLARE
  r RECORD;
  targets TEXT[][] := ARRAY[
    ['menu_items','category_id'],
    ['modifier_options','modifier_id'],
    ['menu_item_modifiers','menu_item_id'],
    ['menu_item_modifiers','modifier_id'],
    ['orders','served_by'],
    ['order_items','order_id'],
    ['order_items','menu_item_id'],
    ['order_item_modifiers','order_item_id'],
    ['order_item_modifiers','modifier_option_id'],
    ['inventory_logs','inventory_item_id'],
    ['inventory_logs','performed_by']
  ];
  t TEXT; c TEXT; i INT;
BEGIN
  FOR i IN 1 .. array_length(targets, 1) LOOP
    t := targets[i][1];
    c := targets[i][2];
    FOR r IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public' AND rel.relname = t AND con.contype = 'f'
        AND EXISTS (
          SELECT 1 FROM unnest(con.conkey) AS k
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
          WHERE att.attname = c
        )
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, r.conname);
      RAISE NOTICE 'dropped % on %.%', r.conname, t, c;
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- STEP 3 — recreate as composite, business-scoped keys
-- ------------------------------------------------------------
-- Note the "ON DELETE SET NULL (column)" form. On a composite key a plain
-- SET NULL would try to null BOTH columns, including business_id, which is
-- NOT NULL — so every delete would fail. The column list restricts it to
-- the child pointer. Requires PG 15+.
--
-- Where the child column is nullable, MATCH SIMPLE skips the check when any
-- key column is NULL. business_id is never NULL, so "no parent set" passes
-- and "parent set" is fully checked.

ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_category_fk
  FOREIGN KEY (business_id, category_id)
  REFERENCES categories (business_id, id) ON DELETE SET NULL (category_id);

ALTER TABLE modifier_options
  ADD CONSTRAINT modifier_options_modifier_fk
  FOREIGN KEY (business_id, modifier_id)
  REFERENCES modifiers (business_id, id) ON DELETE CASCADE;

ALTER TABLE menu_item_modifiers
  ADD CONSTRAINT menu_item_modifiers_item_fk
  FOREIGN KEY (business_id, menu_item_id)
  REFERENCES menu_items (business_id, id) ON DELETE CASCADE;

ALTER TABLE menu_item_modifiers
  ADD CONSTRAINT menu_item_modifiers_modifier_fk
  FOREIGN KEY (business_id, modifier_id)
  REFERENCES modifiers (business_id, id) ON DELETE CASCADE;

ALTER TABLE orders
  ADD CONSTRAINT orders_served_by_fk
  FOREIGN KEY (business_id, served_by)
  REFERENCES staff (business_id, id) ON DELETE SET NULL (served_by);

ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_fk
  FOREIGN KEY (business_id, order_id)
  REFERENCES orders (business_id, id) ON DELETE CASCADE;

-- menu_item_id is nullable and SET NULL on purpose: order_items stores
-- item_name and unit_price as a snapshot, so a past order stays readable
-- and correctly priced after the menu item is deleted or repriced.
-- Never recompute a historical total from the live menu.
ALTER TABLE order_items
  ADD CONSTRAINT order_items_menu_item_fk
  FOREIGN KEY (business_id, menu_item_id)
  REFERENCES menu_items (business_id, id) ON DELETE SET NULL (menu_item_id);

ALTER TABLE order_item_modifiers
  ADD CONSTRAINT order_item_modifiers_item_fk
  FOREIGN KEY (business_id, order_item_id)
  REFERENCES order_items (business_id, id) ON DELETE CASCADE;

-- Same snapshot logic: option_name and price_delta are already stored.
ALTER TABLE order_item_modifiers
  ADD CONSTRAINT order_item_modifiers_option_fk
  FOREIGN KEY (business_id, modifier_option_id)
  REFERENCES modifier_options (business_id, id) ON DELETE SET NULL (modifier_option_id);

ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_item_fk
  FOREIGN KEY (business_id, inventory_item_id)
  REFERENCES inventory_items (business_id, id) ON DELETE CASCADE;

ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_performed_by_fk
  FOREIGN KEY (business_id, performed_by)
  REFERENCES staff (business_id, id) ON DELETE SET NULL (performed_by);

-- ------------------------------------------------------------
-- STEP 4 — scope uniqueness to the business
-- ------------------------------------------------------------
-- order_number restarts per café. Globally unique would make one shop skip
-- numbers whenever another shop placed an order.
--
-- The constraint is dropped before the index: an index owned by a
-- constraint cannot be dropped directly, and the error would abort the
-- whole transaction.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
DROP INDEX IF EXISTS orders_order_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS orders_biz_number_uq
  ON orders (business_id, order_number);

-- Scoped per CATEGORY, not per business: Glimpse of Del's menu carries the
-- same drink in Hot Coffee and Iced Coffee at different prices (Spanish
-- Latte ₱135 hot / ₱120 iced, and five others). A per-business index would
-- have rejected her real menu.
--
-- Two items with the same name and a NULL category_id are permitted, since
-- Postgres treats NULLs as distinct. Acceptable — every real item has a
-- category.
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_biz_cat_name_uq
  ON menu_items (business_id, category_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_biz_name_uq
  ON categories (business_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_uq
  ON businesses (lower(slug))
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- STEP 5 — indexes matching the app's real queries
-- ------------------------------------------------------------
-- Every read is scoped by business_id, so it leads each index. Without
-- these, loading the queue is a sequential scan — which a barista
-- experiences as "the app is broken", not "the app is slow".

CREATE INDEX IF NOT EXISTS orders_biz_status_created_idx
  ON orders (business_id, status, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_biz_created_idx
  ON orders (business_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS order_items_biz_order_idx
  ON order_items (business_id, order_id);

CREATE INDEX IF NOT EXISTS order_item_modifiers_biz_item_idx
  ON order_item_modifiers (business_id, order_item_id);

CREATE INDEX IF NOT EXISTS menu_items_biz_available_idx
  ON menu_items (business_id, is_available, sort_order) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_logs_biz_item_created_idx
  ON inventory_logs (business_id, inventory_item_id, created_at DESC);

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
-- Every parent-child FK should report 2 key columns. The business_id FKs
-- pointing at businesses stay single-column, and so does
-- staff_auth_user_id_fkey, which references Supabase's auth.users.
--
--   SELECT con.conname, rel.relname AS child, ref.relname AS parent,
--          array_length(con.conkey, 1) AS key_columns
--   FROM pg_constraint con
--   JOIN pg_class rel ON rel.oid = con.conrelid
--   JOIN pg_class ref ON ref.oid = con.confrelid
--   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
--   WHERE ns.nspname = 'public' AND con.contype = 'f'
--     AND ref.relname <> 'businesses'
--   ORDER BY child, con.conname;
--
-- Then prove isolation rather than assuming it. Inside a transaction,
-- create a throwaway business and category, try to attach a menu item from
-- another business to that category, and ROLLBACK. The insert must fail:
--
--   ERROR: 23503 insert or update on table "menu_items" violates foreign
--   key constraint "menu_items_category_fk"
-- ============================================================
