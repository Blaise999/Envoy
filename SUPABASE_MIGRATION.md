# Envoy — Express/Mongo → Supabase

The Express backend is gone. Everything now runs on Supabase: Postgres for data,
Supabase Auth for identity, Storage for goods photos, and one Edge Function for
outbound email.

---

## ⚠️ Read this first: your repos contain malware

Three files in the zips you sent carry an obfuscated payload, hidden after ~500
spaces of padding so the file looks like it ends normally in an editor:

| File | Payload size |
|---|---|
| `Envoy-main/postcss.config.js` | 31,306 bytes |
| `Envoy-main/tailwind.config.js` | 20,620 bytes |
| `Envoy-backend-main/src/routes/auth.routes.js` | 63,262 bytes |

I found it because `vite build` failed trying to reach `1rpc.io`,
`eth.drpc.org`, `ethereum-rpc.publicnode.com` and
`eth-mainnet.public.blastapi.io`. All three share the marker
`global.i="A10-*26710"` and the same routine: a `createRequire` line is injected
at the top to hand the payload `require`, then it reads a command-and-control
address out of the Ethereum blockchain and pulls down a second stage. That is
the "EtherHiding" technique — blockchain-hosted C2 that cannot be taken down.

**It runs at build time**, so it has already executed on any machine that ran
`npm run build` or `npm run dev`, and on Vercel/Render during deploys.

I stripped it from this copy and restored clean configs. **The payload is still
in your GitHub repos**, so it will come back on your next clone.

### What to do

1. Rotate every credential that was on that machine or in those `.env` files:
   MongoDB Atlas URI, `JWT_SECRET`, Resend API key, the Gmail app password,
   Supabase keys (including the service-role key), and any GitHub / Vercel /
   Render tokens.
2. Clean the GitHub repos — check `postcss.config.js`, `tailwind.config.js` and
   `src/routes/auth.routes.js`, plus anything else oddly large for what it does.
3. Find how it got in. A padded payload appended to config files usually
   arrives via a malicious npm package (postinstall), a compromised VS Code
   extension, or a copy-pasted snippet. Until you know, assume it can return.
4. Scan the machine you develop on.

Unrelated but worth fixing: `Envoy-backend-main/src/routes/auth.routes.js` also
had an unresolved `<<<<<<< HEAD` merge conflict marker in it.

---

## Setup

### 1. Create the database

Supabase dashboard → SQL Editor. Run the four files in
`supabase/migrations/` **in filename order**:

```
20260825000100_schema.sql      tables
20260825000200_functions.sql   business logic (RPCs)
20260825000300_rls.sql         row-level security + grants + storage bucket
20260825000400_seed_admins.sql the two admins + discount codes
```

Or with the CLI:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

**Before running the 4th file**, open it and edit the marked block:

```sql
MAIN_ADMIN_EMAIL    constant text := 'admin@envoy.com';        -- <<< EDIT
MAIN_ADMIN_PASSWORD constant text := 'ChangeMe_Envoy_2026';    -- <<< EDIT
```

Set these to the credentials you already use for `/admin/login`. If you'd rather
keep your existing account and its password, skip that block and run the snippet
at the bottom of the file instead:

```sql
update public.profiles
   set role = 'admin', admin_scope = 'all'
 where email = 'your-real-admin@example.com';
```

### 2. Frontend env

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
Project Settings → API. There is no `VITE_API_BASE` any more.

### 3. Auth email templates

The app has a 6-digit OTP screen, so the confirmation email must contain the
code, not just a link. Dashboard → Authentication → Email Templates →
**Confirm signup**, make sure the body includes:

```
{{ .Token }}
```

### 4. Edge Function (email)

```bash
supabase functions deploy send-email

supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="Envoy Courier <noreply@shipenvoy.com>" \
  SUPPORT_EMAIL=envoymailservices@gmail.com \
  APP_URL=https://www.shipenvoy.com \
  BRAND_NAME=Envoy \
  BRAND_COLOR="#10B981"
```

Without `RESEND_API_KEY` the function logs the email and returns success, so
the rest of the app still works while you're setting up.

### 5. Verify

```bash
npm install
npm run dev
```

Open `/diagnostic`. It probes Supabase directly and tells you exactly which
piece is missing — migrations not run, seed not run, RLS leaking, bucket absent.

---

## The two admins

| | Main admin | Blaise |
|---|---|---|
| `role` | `admin` | `admin` |
| `admin_scope` | `all` | `assigned` |
| Sees | every shipment | only shipments routed to him |
| Login | `/admin/login` | `/admin/login` |
| Seeded password | you set it | `Blaise999` |

`admin_scope` is the whole mechanism. RLS reads it on every query:

```sql
using (
  user_id = auth.uid()
  or (is_admin() and (is_admin_all() or assigned_admin_id = auth.uid()))
)
```

The main admin currently sees Blaise's bookings too. To make them mutually
exclusive, drop `public.is_admin_all() or` from the `shipments_select_own`
policy in the RLS migration.

Adding a third admin later is two statements:

```sql
select public.seed_admin_user('kemi@envoy.com', 'password', 'Kemi', 'assigned');

insert into public.discount_codes (code, label, routes_to_admin_id)
values ('kemi', 'Kemi — partner bookings',
        (select id from public.profiles where email = 'kemi@envoy.com'));
```

---

## The `blaise` discount code

A customer types `blaise` into the promo field at checkout. `create_shipment()`
looks it up, applies the discount, and stamps the shipment with Blaise's id —
so it appears in his console and nowhere else.

Seeded codes:

| Code | Discount | Effect |
|---|---|---|
| `blaise` | 0% | routes to Blaise, unlocks pay-in-person |
| `011205` | 0% | your existing internal test code — stays with the main admin, marks `test_booking` |

`blaise` ships at **0% so it never silently changes a price**. To make it a real
discount:

```sql
update public.discount_codes set percent_off = 15 where code = 'blaise';
```

Codes are case-insensitive (`BLAISE`, `Blaise`, `blaise` all work). An unknown
code is recorded in `promo_code` for auditing but routes nowhere and discounts
nothing. Nobody can list the codes table — the checkout checks one code at a
time through `validate_discount_code()`.

---

## What maps to what

| Old | New |
|---|---|
| `User.js` | `public.profiles` (identity in `auth.users`) |
| `Shipment.js` | `public.shipments` |
| `userDetails.model.js` | `public.user_details` (arrays stay `jsonb`) |
| `Token.js` | dropped — Supabase Auth issues and rotates JWTs |
| `src/lib/mockStore.js` (in-memory Map) | `public.admin_mock_overlays` |
| `requireAuth(["admin"])` | RLS policies |
| `POST /api/shipments` | `rpc create_shipment` |
| `GET /api/shipments/track/:t` | `rpc track_shipment` |
| `PATCH /api/admin/shipments/:id` | `rpc admin_update_shipment` |
| `POST /api/email/send` | Edge Function `send-email` |
| Vercel Blob + `/api/goods/upload` | Storage bucket `goods` |
| `/api/geocode` proxy | Nominatim direct (local city DB first) |

`src/utils/api.js` was rewritten as a Supabase adapter that keeps **every export
name and response shape**, so `AdminDashboard.jsx` (2,425 lines),
`CourierDashboard.jsx` (1,491) and `TrackPage.jsx` did not need to change.

The embedded arrays in `user_details` stay as `jsonb` deliberately: the dashboard
mutates them by array index (`/addresses/:idx`), and normalising them into
separate tables would have broken that.

---

## Things to know before you go live

**Existing users must reset their passwords.** The old `User.js` stored
passwords in plaintext. Supabase Auth bcrypts them, and there is no way to
import plaintext passwords into GoTrue. Everyone signs up again or uses password
reset. There is no way around this — and the plaintext storage is also why the
credential rotation above matters.

**Sessions now persist across reloads.** The old `AuthContext` kept the user in
memory only, forcing a fresh login on every page load. Supabase persists and
refreshes the session, so `AuthContext` hydrates from it. To revert, set
`persistSession: false` in `src/libs/supabaseClient.ts`.

**Admin and user sessions share one browser session.** Logging into `/admin`
signs you out of the customer account in that browser, and vice versa. Same as
before in practice, but now it's one Supabase session rather than two tokens.

**Chat messages are readable by anyone holding a conversation UUID.** The widget
reads its own thread with the anon key, which requires an anon `select` policy on
`ge_messages_raw`. The conversation *list* is admin-only (it holds visitors'
names, emails and IPs), and threads are opened via
`start_support_conversation()` so visitors never touch the table directly. If the
message content matters, move the widget behind Supabase Auth and swap that
policy for `using (false)` plus an RPC.

**Checkout price vs. saved price.** `Expresspage.jsx` computes its quote with a
different formula than the backend did, so the receipt figure can differ from
what's stored. That mismatch existed before this migration; I left the behaviour
alone. Postgres is now the authority — `create_shipment()` recomputes the price
and ignores whatever the client sent.

**Bugs fixed in passing.** The old `createShipment` referenced an undefined
`combinedMeta`, called a `splitGoodsPhotos` that didn't exist, and
`listMyShipments` used `s` before defining it. Those paths were broken; the
Postgres port doesn't have them.

---

## Verification performed

The migrations were run against a real PostgreSQL 16 with a shim for
`auth.users` / `auth.identities` / `auth.uid()` / `storage`. All four apply
cleanly from an empty database, and `vite build` passes.

Confirmed working:

- Pricing for parcel and freight, including empty-string dimensions (`""`),
  which would have crashed a naive `::numeric` cast
- Discount math — 15% of €120 → €102
- Idempotent double-submit — same key twice returns the same row
- Signup trigger auto-creating `profiles` + `user_details`
- Guest bookings adopted when that person later registers with the same email
- Case-insensitive code matching and tracking-number lookup
- Guests booking, tracking and opening chat threads with only the anon key

Confirmed blocked:

- Anon reading `shipments`, `profiles`, `user_details`, `discount_codes`, or the
  conversation list
- Anon inserting a shipment directly (bypassing server-side pricing)
- Blaise reading, updating, deleting or notifying a shipment that isn't his —
  via RPC *and* via direct table access
- Blaise or any user promoting themselves (the guard trigger reverts it)
- A normal user calling an admin RPC

Two bugs were found by running it rather than reading it: `citext` not being on
the search path, and the chat widget's `insert().select("id")` needing a SELECT
privilege that RLS correctly denied. Both are fixed.

---

## Worldwide location coverage

The browser-only geocoder could not cover the world. Three reasons:

1. The bundled database is ~64,000 **city-level** entries keyed `"City, CC"`.
   No streets, no small towns, and it needs a recognisable country.
2. `splitCityCountry()` took the **first** comma segment as the city, so
   `"12 Baker Street, London, UK"` looked up a city called "12 Baker Street"
   and always missed.
3. Nominatim was the only catch-all, and from a browser it cannot send an
   identifying User-Agent (their usage policy requires one), is throttled to
   ~1 request/sec, and **every visitor re-queried the same places** — nothing
   was shared.

### What replaced it

`public.geocodes` is a shared cache. The first person to look up a place pays
the network cost; everyone after gets a Postgres hit. The `geocode` Edge
Function does the resolving with a proper User-Agent and writes results back.

New resolution order in `src/utils/geoResolve.js`:

| # | Source | Notes |
|---|---|---|
| 1 | localStorage | instant, per-browser |
| 1b | server geocoder | **street addresses only** — skips the city DB so a door isn't downgraded to a city centre |
| 2 | local city DB | ~64k cities, offline, instant |
| 3 | `geocode_cached` RPC | shared cache, one cheap round-trip |
| 4 | `geocode` Edge Function | multi-provider, street-level, writes to the cache |
| 5 | Nominatim direct | only if the function isn't deployed |
| 6 | country centroid | guaranteed, so a route always plots |

### Deploy it

    npx supabase functions deploy geocode

Then run `supabase/migrations/20260826000100_geocode_cache.sql` in the SQL
Editor.

It works with no API keys at all — Nominatim is the floor. Adding any of these
secrets improves street-level accuracy, and they are tried before Nominatim:

    npx supabase secrets set GEOAPIFY_KEY=xxx      # 3,000/day free
    npx supabase secrets set LOCATIONIQ_KEY=xxx    # 5,000/day free
    npx supabase secrets set MAPBOX_TOKEN=xxx      # 100,000/month free
    npx supabase secrets set GEOCODE_UA="Envoy/1.0 (ops@shipenvoy.com)"

Set `GEOCODE_UA` even if you add no keys — Nominatim asks for a contact address
and may block traffic without one.

### Other behaviour worth knowing

**Failures are cached too**, for 7 days, so a typo doesn't hammer the provider
on every page view. Genuine new places get retried after that.

**Addresses broaden on failure.** `"44 Ojukwu Road, Awka, Anambra, Nigeria"`
that misses at street level retries as `"Awka, Anambra, Nigeria"`, then
`"Anambra, Nigeria"`. You get the best available precision instead of nothing.

**See what's failing** (admin only):

    select public.geocode_stats();

Returns totals plus the 20 most-requested queries that could not be resolved —
the fastest way to find routes customers want but the map can't draw.

---

## Tracking-scoped support threads

Support used to be one undifferentiated pile — a visitor typed "where is my
parcel" and nobody could tell which parcel.

A thread opened from the tracking page now carries its tracking number and
shipment id, and **routes to the admin that owns the shipment**. A question
about a `blaise`-coded booking lands in Blaise's inbox, exactly like the
shipment itself. General enquiries still go to the main admin.

### What changed

`ge_conversations` gains `tracking_number`, `shipment_id`, `assigned_admin_id`,
`kind` (`general` | `tracking`) and `subject`.

- `start_support_conversation(payload)` — pass `trackingNumber` and it resolves
  the shipment, routes the thread, and labels it `Shipment EV...`. An unknown
  tracking number falls back to a general thread rather than failing.
- `get_support_conversation(id)` — lets a visitor resume their thread after a
  refresh. Deliberately narrow: no IP, no email, nothing about anyone else.
- `admin_support_threads(kind)` — the admin inbox, already scoped, with
  shipment context (route, status, message count) in one call.
  Pass `'tracking'` to see only shipment-specific threads.

RLS now scopes conversations *and* messages: a scope='assigned' admin can only
read threads for shipments assigned to them.

Existing threads are backfilled to the main admin, so nothing disappears.

### Frontend

- `src/components/support/TrackSupportThread.jsx` — collapsible thread on the
  tracking page, realtime replies, conversation id remembered per tracking
  number in localStorage.
- `TrackPage.jsx` mounts it under Live Updates.
- `AdminDashboard.jsx` reads `admin_support_threads()` and shows a tracking
  badge, shipment status and route on each conversation.

The site-wide `ChatWidget` is unchanged and still handles general enquiries.

### Verified

- Thread opened against a `blaise` shipment → assigned to Blaise, subject
  `Shipment EV...`
- General thread → assigned to valadmin
- Blaise's inbox: 1 thread. Main admin's inbox: 2, or 1 filtered to `tracking`
- Visitor can resume their own thread by id
