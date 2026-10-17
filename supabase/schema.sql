-- ============================================================
-- BrewOS — the whole database schema, as it stands. REBUILD FROM THIS.
-- Dumped 2026-10-17 from the original Supabase project (ap-southeast-2)
-- and loaded into the current one (ap-southeast-1); the two dumps match
-- line for line apart from the server version.
-- ============================================================
--
-- TWO FILES, TWO JOBS. The overlap is deliberate; don't "fix" it.
--
--   schema.sql (this file)  What the database IS. The only way to build it
--                           from the repo: the original tables were created
--                           in the Supabase dashboard and never committed.
--
--   migrations/001–005      What CHANGED, and WHY. The record of each change
--                           and its reasoning. They ALTER tables that already
--                           exist, so they can't build a database on their
--                           own, and must not be run on top of this file:
--                           everything they did is already in it.
--
-- A future schema change: write migration 006 as usual (the why), apply it,
-- then regenerate this file from the live project (the what):
--
--   pg_dump --schema-only --schema=public --no-owner
--
-- and drop the same lines this one drops (below).
--
-- TO REBUILD: on an empty Supabase project, run this file, then load the
-- data. It creates the public schema's tables, functions, triggers, RLS
-- policies and grants. Differences from a raw pg_dump, so it runs as the
-- `postgres` role and in the SQL editor:
--   - no CREATE SCHEMA public (Supabase creates it);
--   - no ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin (Supabase's own;
--     `postgres` can't set them, and a new project already has them);
--   - no \restrict / \unrestrict (pg_dump 17.6+ psql-only lines).
--
-- NOT in this file — set up separately on a new project:
--   - Auth users. Logins live in Supabase Auth, not here; each staff row's
--     auth_user_id must point at a user that exists in that project.
--   - The ensure_rls event trigger (Supabase's "enable RLS on new tables"),
--     which calls rls_auto_enable() below. Event triggers are database-level,
--     so pg_dump of a schema doesn't carry them. The current project doesn't
--     have it: a table created later must enable RLS itself.
--   - Data: menu, business, staff.
--
-- Grants matter here: anon and authenticated get no SELECT/INSERT/UPDATE/
-- DELETE on any table. The backend uses the service role. Never grant
-- SELECT on staff to authenticated (CLAUDE.md): it would expose pin_hash.
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: generate_order_number(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number(p_business_id uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  -- Soft-deleted orders still count. A voided order's number was already
  -- shown to a customer; reusing it would put two different orders under
  -- one number and collide with orders_biz_number_uq.
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 5) AS BIGINT)
  ), 0) + 1
  INTO seq_val
  FROM orders
  WHERE business_id = p_business_id;

  RETURN 'ORD-' || LPAD(seq_val::TEXT, 4, '0');
END;
$$;


--
-- Name: orders_paid_at_once(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.orders_paid_at_once() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    timezone text DEFAULT 'Asia/Manila'::text NOT NULL,
    currency_code text DEFAULT 'PHP'::text NOT NULL,
    logo_url text,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: COLUMN businesses.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.settings IS 'Per-business preferences: messenger_template, gcash_number, maya_number. Absent key = backend default.';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'g'::text NOT NULL,
    quantity numeric(10,3) DEFAULT 0 NOT NULL,
    low_stock_threshold numeric(10,3) DEFAULT 0 NOT NULL,
    cost_per_unit numeric(10,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: inventory_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    change_type text NOT NULL,
    quantity_change numeric(10,3) NOT NULL,
    notes text,
    performed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_logs_change_type_check CHECK ((change_type = ANY (ARRAY['restock'::text, 'deduction'::text, 'adjustment'::text, 'waste'::text])))
);


--
-- Name: menu_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_modifiers (
    menu_item_id uuid NOT NULL,
    modifier_id uuid NOT NULL,
    business_id uuid NOT NULL
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    base_price numeric(10,2) NOT NULL,
    image_url text,
    is_available boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: modifier_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modifier_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    modifier_id uuid NOT NULL,
    name text NOT NULL,
    price_delta numeric(10,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_available boolean DEFAULT true NOT NULL
);


--
-- Name: modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: order_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    modifier_option_id uuid,
    option_name text NOT NULL,
    price_delta numeric(10,2) DEFAULT 0 NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    order_id uuid NOT NULL,
    menu_item_id uuid,
    item_name text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    item_category text
);


--
-- Name: COLUMN order_items.item_category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.order_items.item_category IS 'Snapshot of categories.name when the order was placed. Never recomputed from the live menu.';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    order_number text NOT NULL,
    source text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    customer_name text,
    customer_contact text,
    notes text,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    payment_method text,
    payment_status text DEFAULT 'unpaid'::text NOT NULL,
    served_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    paid_at timestamp with time zone,
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'gcash'::text, 'maya'::text, 'card'::text, 'pending'::text]))),
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'refunded'::text]))),
    CONSTRAINT orders_source_check CHECK ((source = ANY (ARRAY['walk_in'::text, 'messenger'::text, 'phone'::text, 'online'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'brewing'::text, 'ready'::text, 'picked_up'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN orders.paid_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.paid_at IS 'When the order first became paid. Set once by orders_paid_at_once; never moved. Daily sales use its Asia/Manila date.';


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    auth_user_id uuid,
    display_name text NOT NULL,
    role text NOT NULL,
    pin_hash text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT staff_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'barista'::text, 'cashier'::text])))
);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: categories categories_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_biz_id_uq UNIQUE (business_id, id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_biz_id_uq UNIQUE (business_id, id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_logs inventory_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_pkey PRIMARY KEY (id);


--
-- Name: menu_item_modifiers menu_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_pkey PRIMARY KEY (menu_item_id, modifier_id);


--
-- Name: menu_items menu_items_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_biz_id_uq UNIQUE (business_id, id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: modifier_options modifier_options_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifier_options
    ADD CONSTRAINT modifier_options_biz_id_uq UNIQUE (business_id, id);


--
-- Name: modifier_options modifier_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifier_options
    ADD CONSTRAINT modifier_options_pkey PRIMARY KEY (id);


--
-- Name: modifiers modifiers_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_biz_id_uq UNIQUE (business_id, id);


--
-- Name: modifiers modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_pkey PRIMARY KEY (id);


--
-- Name: order_item_modifiers order_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_biz_id_uq UNIQUE (business_id, id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_biz_id_uq UNIQUE (business_id, id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: staff staff_biz_id_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_biz_id_uq UNIQUE (business_id, id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: businesses_slug_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_slug_uq ON public.businesses USING btree (lower(slug)) WHERE (deleted_at IS NULL);


--
-- Name: categories_biz_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_biz_name_uq ON public.categories USING btree (business_id, lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: idx_categories_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_business ON public.categories USING btree (business_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_inventory_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_business ON public.inventory_items USING btree (business_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_menu_items_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_business ON public.menu_items USING btree (business_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_modifiers_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modifiers_business ON public.modifiers USING btree (business_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_business_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_business_created ON public.orders USING btree (business_id, created_at DESC);


--
-- Name: idx_orders_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_business_status ON public.orders USING btree (business_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_staff_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_business ON public.staff USING btree (business_id) WHERE (deleted_at IS NULL);


--
-- Name: inventory_logs_biz_item_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_logs_biz_item_created_idx ON public.inventory_logs USING btree (business_id, inventory_item_id, created_at DESC);


--
-- Name: menu_items_biz_available_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX menu_items_biz_available_idx ON public.menu_items USING btree (business_id, is_available, sort_order) WHERE (deleted_at IS NULL);


--
-- Name: menu_items_biz_cat_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX menu_items_biz_cat_name_uq ON public.menu_items USING btree (business_id, category_id, lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: order_item_modifiers_biz_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_item_modifiers_biz_item_idx ON public.order_item_modifiers USING btree (business_id, order_item_id);


--
-- Name: order_items_biz_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_biz_order_idx ON public.order_items USING btree (business_id, order_id);


--
-- Name: orders_biz_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_biz_created_idx ON public.orders USING btree (business_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: orders_biz_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_biz_number_uq ON public.orders USING btree (business_id, order_number);


--
-- Name: orders_biz_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_biz_status_created_idx ON public.orders USING btree (business_id, status, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: orders_business_paid_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_business_paid_at_idx ON public.orders USING btree (business_id, paid_at) WHERE (deleted_at IS NULL);


--
-- Name: orders orders_paid_at_once; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_paid_at_once BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_paid_at_once();


--
-- Name: businesses trg_businesses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: categories trg_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: inventory_items trg_inventory_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: menu_items trg_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: modifiers trg_modifiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_modifiers_updated_at BEFORE UPDATE ON public.modifiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: orders trg_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: staff trg_staff_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: categories categories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: inventory_items inventory_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: inventory_logs inventory_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: inventory_logs inventory_logs_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_item_fk FOREIGN KEY (business_id, inventory_item_id) REFERENCES public.inventory_items(business_id, id) ON DELETE CASCADE;


--
-- Name: inventory_logs inventory_logs_performed_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_logs
    ADD CONSTRAINT inventory_logs_performed_by_fk FOREIGN KEY (business_id, performed_by) REFERENCES public.staff(business_id, id) ON DELETE SET NULL (performed_by);


--
-- Name: menu_item_modifiers menu_item_modifiers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: menu_item_modifiers menu_item_modifiers_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_item_fk FOREIGN KEY (business_id, menu_item_id) REFERENCES public.menu_items(business_id, id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_modifier_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_modifier_fk FOREIGN KEY (business_id, modifier_id) REFERENCES public.modifiers(business_id, id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: menu_items menu_items_category_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_fk FOREIGN KEY (business_id, category_id) REFERENCES public.categories(business_id, id) ON DELETE SET NULL (category_id);


--
-- Name: modifier_options modifier_options_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifier_options
    ADD CONSTRAINT modifier_options_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: modifier_options modifier_options_modifier_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifier_options
    ADD CONSTRAINT modifier_options_modifier_fk FOREIGN KEY (business_id, modifier_id) REFERENCES public.modifiers(business_id, id) ON DELETE CASCADE;


--
-- Name: modifiers modifiers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modifiers
    ADD CONSTRAINT modifiers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: order_item_modifiers order_item_modifiers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: order_item_modifiers order_item_modifiers_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_item_fk FOREIGN KEY (business_id, order_item_id) REFERENCES public.order_items(business_id, id) ON DELETE CASCADE;


--
-- Name: order_item_modifiers order_item_modifiers_option_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_modifiers
    ADD CONSTRAINT order_item_modifiers_option_fk FOREIGN KEY (business_id, modifier_option_id) REFERENCES public.modifier_options(business_id, id) ON DELETE SET NULL (modifier_option_id);


--
-- Name: order_items order_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: order_items order_items_menu_item_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_fk FOREIGN KEY (business_id, menu_item_id) REFERENCES public.menu_items(business_id, id) ON DELETE SET NULL (menu_item_id);


--
-- Name: order_items order_items_order_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_fk FOREIGN KEY (business_id, order_id) REFERENCES public.orders(business_id, id) ON DELETE CASCADE;


--
-- Name: orders orders_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: orders orders_served_by_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_served_by_fk FOREIGN KEY (business_id, served_by) REFERENCES public.staff(business_id, id) ON DELETE SET NULL (served_by);


--
-- Name: staff staff_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);


--
-- Name: staff staff_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses businesses_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_insert ON public.businesses FOR INSERT WITH CHECK (true);


--
-- Name: businesses businesses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_select ON public.businesses FOR SELECT USING (true);


--
-- Name: businesses businesses_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_update ON public.businesses FOR UPDATE USING (true);


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert ON public.categories FOR INSERT WITH CHECK (true);


--
-- Name: categories categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select ON public.categories FOR SELECT USING (true);


--
-- Name: categories categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update ON public.categories FOR UPDATE USING (true);


--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items inventory_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_insert ON public.inventory_items FOR INSERT WITH CHECK (true);


--
-- Name: inventory_items inventory_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT USING (true);


--
-- Name: inventory_items inventory_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_update ON public.inventory_items FOR UPDATE USING (true);


--
-- Name: inventory_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_logs inventory_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_logs_insert ON public.inventory_logs FOR INSERT WITH CHECK (true);


--
-- Name: inventory_logs inventory_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_logs_select ON public.inventory_logs FOR SELECT USING (true);


--
-- Name: inventory_logs inventory_logs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_logs_update ON public.inventory_logs FOR UPDATE USING (true);


--
-- Name: menu_item_modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_item_modifiers menu_item_modifiers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_item_modifiers_insert ON public.menu_item_modifiers FOR INSERT WITH CHECK (true);


--
-- Name: menu_item_modifiers menu_item_modifiers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_item_modifiers_select ON public.menu_item_modifiers FOR SELECT USING (true);


--
-- Name: menu_item_modifiers menu_item_modifiers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_item_modifiers_update ON public.menu_item_modifiers FOR UPDATE USING (true);


--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items menu_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_insert ON public.menu_items FOR INSERT WITH CHECK (true);


--
-- Name: menu_items menu_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_select ON public.menu_items FOR SELECT USING (true);


--
-- Name: menu_items menu_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_items_update ON public.menu_items FOR UPDATE USING (true);


--
-- Name: modifier_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;

--
-- Name: modifier_options modifier_options_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifier_options_insert ON public.modifier_options FOR INSERT WITH CHECK (true);


--
-- Name: modifier_options modifier_options_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifier_options_select ON public.modifier_options FOR SELECT USING (true);


--
-- Name: modifier_options modifier_options_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifier_options_update ON public.modifier_options FOR UPDATE USING (true);


--
-- Name: modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: modifiers modifiers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifiers_insert ON public.modifiers FOR INSERT WITH CHECK (true);


--
-- Name: modifiers modifiers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifiers_select ON public.modifiers FOR SELECT USING (true);


--
-- Name: modifiers modifiers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modifiers_update ON public.modifiers FOR UPDATE USING (true);


--
-- Name: order_item_modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_modifiers order_item_modifiers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_modifiers_insert ON public.order_item_modifiers FOR INSERT WITH CHECK (true);


--
-- Name: order_item_modifiers order_item_modifiers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_modifiers_select ON public.order_item_modifiers FOR SELECT USING (true);


--
-- Name: order_item_modifiers order_item_modifiers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_modifiers_update ON public.order_item_modifiers FOR UPDATE USING (true);


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_insert ON public.order_items FOR INSERT WITH CHECK (true);


--
-- Name: order_items order_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_select ON public.order_items FOR SELECT USING (true);


--
-- Name: order_items order_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_update ON public.order_items FOR UPDATE USING (true);


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert ON public.orders FOR INSERT WITH CHECK (true);


--
-- Name: orders orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select ON public.orders FOR SELECT USING (true);


--
-- Name: orders orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update ON public.orders FOR UPDATE USING (true);


--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_insert ON public.staff FOR INSERT WITH CHECK (true);


--
-- Name: staff staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_select ON public.staff FOR SELECT USING (true);


--
-- Name: staff staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_update ON public.staff FOR UPDATE USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION generate_order_number(p_business_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_order_number(p_business_id uuid) TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: TABLE businesses; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.businesses TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.businesses TO authenticated;
GRANT ALL ON TABLE public.businesses TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.categories TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_items TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_items TO authenticated;
GRANT ALL ON TABLE public.inventory_items TO service_role;


--
-- Name: TABLE inventory_logs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_logs TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_logs TO authenticated;
GRANT ALL ON TABLE public.inventory_logs TO service_role;


--
-- Name: TABLE menu_item_modifiers; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.menu_item_modifiers TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.menu_item_modifiers TO authenticated;
GRANT ALL ON TABLE public.menu_item_modifiers TO service_role;


--
-- Name: TABLE menu_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.menu_items TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.menu_items TO authenticated;
GRANT ALL ON TABLE public.menu_items TO service_role;


--
-- Name: TABLE modifier_options; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.modifier_options TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.modifier_options TO authenticated;
GRANT ALL ON TABLE public.modifier_options TO service_role;


--
-- Name: TABLE modifiers; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.modifiers TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.modifiers TO authenticated;
GRANT ALL ON TABLE public.modifiers TO service_role;


--
-- Name: TABLE order_item_modifiers; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_item_modifiers TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_item_modifiers TO authenticated;
GRANT ALL ON TABLE public.order_item_modifiers TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_items TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.orders TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: TABLE staff; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.staff TO anon;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.staff TO authenticated;
GRANT ALL ON TABLE public.staff TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


