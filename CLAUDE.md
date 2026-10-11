# BrewOS

Café operations system for **Glimpse of Del**, a single-operator coffee shop in
Los Baños, Laguna. Built by Jae (BSCS, LSPU-LB) as a client project and the
second portfolio case study after Bloom OS.

## Stack

- **Frontend** — React + Vite + TypeScript + Tailwind, deployed on Vercel
- **Backend** — FastAPI on Render (free tier)
- **Database** — Supabase PostgreSQL
- **Live** — `brewos-mu.vercel.app` · `brewos-api.onrender.com`

## Who uses it

One person. The owner is the barista, the cashier and the manager. She runs it
on an **Android phone**. Every design decision follows from that:

- Touch targets must work for someone holding a phone in one hand with a
  portafilter in the other.
- No feature should assume a second user exists. Staff accounts are a later
  phase.
- She must be able to change her own menu and prices without messaging Jae.
  Anything that forces her to ask for help is a bug, not a missing feature.

### Accounts

Glimpse of Del has **two owner accounts**, both `staff` rows with
`role = 'owner'` and the same `business_id`:

- **Hers** — for running the café. Created at handover.
- **Jae (support)** — Jae's, for support and diagnostics on the retainer, so
  he never needs her password.

Both have **full access**: menu, orders and sales. The support account must
be disclosed to her **in writing at handover**, including how to disable it:
set `is_active = false` on its `staff` row. That takes effect on the next
request — `app/security.py` re-reads the staff row on every request rather
than trusting the 30-day token — so disabling it is immediate, not "within
30 days". Never remove that per-request check; it is also what will cut off
staff accounts once they exist.

Nothing in the code may assume a business has exactly one owner.

## Design system — "Night Market"

| | |
|---|---|
| Display font | `Bebas Neue` |
| Body font | `Figtree` |
| Data / numerals | `JetBrains Mono` |
| Background | dark warm brown `#14100C` |
| Accent | tungsten gradient `#FFB347 → #FF6B35` |

Utility classes already defined — **use these, don't invent new ones**:
`.display` `.data` `.label` `.panel` `.btn-fire` `.btn-ghost` `.chip`
`.chip-on` `.tog` `.heat-border`

## Database rules

The schema is **multi-tenant**. Every table carries `business_id`.

- **Never** accept `business_id` as a request parameter. Resolve it once from
  the authenticated session, in middleware, and pass it down.
- Every query must be scoped by `business_id`. A missing scope is a data leak
  between cafés, not a bug.
- Foreign keys are **composite** — children reference `(business_id, id)`, so
  the database itself rejects a cross-tenant reference. Keep it that way when
  adding tables.
- `order_number` is unique **per business**, not globally.

### Historical accuracy

`order_items` stores `item_name` and `unit_price` as a **snapshot** at the time
of the order. `order_item_modifiers` likewise stores `option_name` and
`price_delta`.

Never recompute a past order's total from the live menu. If she reprices a latte
in March, the February orders must still show February's price. This is why
`menu_item_id` is nullable with `ON DELETE SET NULL`.

### Soft deletes

Most tables have `deleted_at`. Filter `WHERE deleted_at IS NULL` on every read
unless you specifically want history.

## Constraints that shape the code

**Free tier, deliberately.** Supabase and Render free tiers, no paid Claude API
key. Render cold-starts after idle, so the app has wake detection and a banner.
Don't add anything that assumes a warm backend or a paid service.

**PWA, not native.** Installable, runs from the home screen. Deliberately
**not** offline-first — API responses are never cached. If the connection
drops, the app says so rather than queueing an order locally that might never
sync. A visible error beats a silently lost order.

**No AI in the hot path.** The Messenger parser uses deterministic extraction
and fuzzy matching (`rapidfuzz`) against the live menu, not an LLM. It is
cheaper, more predictable, and runs on free tier. It always produces a *draft*
for human review — it never submits an order by itself.

## Phases

**Phase 1 (current, ₱20,000)** — order entry · queue · menu management she can
edit herself · Messenger order parser · daily sales · PWA install · one
training session.

**Phase 2 (₱3,000–5,000, separate)** — Bluetooth thermal receipt printing.
58mm printer, Web Bluetooth + ESC/POS straight from the PWA. A branded order
slip, **not** a BIR official receipt.

**Later phases** — inventory, expense tracking, staff accounts, loyalty, online
ordering, multi-branch. Not in scope; don't build toward them speculatively.

## Working style

- Read the existing code before adding to it. Match its conventions over any
  general best practice.
- Small, reviewable changes. This is a solo project maintained by a student
  during term time — clever is worse than obvious.
- When something is ambiguous, ask rather than guess.
