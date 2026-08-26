-- ============================================================================
-- Envoy — Supabase schema
-- Ported 1:1 from the Express/Mongoose backend models:
--   User.js            -> public.profiles          (identity lives in auth.users)
--   Shipment.js        -> public.shipments
--   userDetails.model  -> public.user_details      (embedded arrays kept as jsonb)
--   Token.js           -> dropped (Supabase Auth issues + rotates JWTs)
--
-- New tables that did not exist in Mongo:
--   public.discount_codes        -> promo / routing codes ("blaise", "011205")
--   public.admin_mock_overlays   -> replaces the in-memory mockStore
--   public.ge_conversations      -> already used by ChatWidget, now declared here
--   public.ge_messages_raw       -> already used by ChatWidget, now declared here
-- ============================================================================

-- citext / pgcrypto live in the `extensions` schema on Supabase, so they must
-- be on the search path for `citext` column types and `::citext` casts to
-- resolve. Every function below repeats this in its own `set search_path`.
set search_path = public, extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- profiles  (was: User.js)
-- ===========================================================================
-- role        : 'user' | 'admin'                    (same as Mongo)
-- admin_scope : 'all'  -> ops console sees every shipment (the main admin)
--               'assigned' -> only shipments routed to this admin (e.g. Blaise)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text        not null default '',
  email        citext      unique,
  phone        text        not null default '',
  address      text        not null default '',
  role         text        not null default 'user'     check (role in ('user','admin')),
  admin_scope  text        not null default 'assigned' check (admin_scope in ('all','assigned')),
  is_verified  boolean     not null default false,
  last_login   timestamptz,
  meta         jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx  on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- discount_codes  (new — powers the "code routes the shipment to an admin" rule)
-- ===========================================================================
create table if not exists public.discount_codes (
  code                  citext primary key,
  label                 text        not null default '',
  percent_off           numeric(5,2) not null default 0 check (percent_off >= 0 and percent_off <= 100),
  amount_off            numeric(12,2) not null default 0 check (amount_off >= 0),
  -- shipments booked with this code become the property of this admin
  routes_to_admin_id    uuid references public.profiles(id) on delete set null,
  -- mirrors the old TEST_PROMO_CODE behaviour: skip the card form, pay in person
  unlocks_pay_in_person boolean not null default false,
  -- mirrors Shipment.testBooking
  marks_test_booking    boolean not null default false,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists discount_codes_touch on public.discount_codes;
create trigger discount_codes_touch before update on public.discount_codes
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- shipments  (was: Shipment.js)
-- ===========================================================================
create table if not exists public.shipments (
  id                uuid primary key default gen_random_uuid(),

  -- ownership -------------------------------------------------------------
  user_id           uuid references public.profiles(id) on delete set null,
  -- which admin "owns" this booking (set by the discount/routing code)
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  routing_code      citext,

  service_type      text not null default 'parcel' check (service_type in ('parcel','freight')),

  -- simple text locations, exactly like the Mongo model -------------------
  from_location     text not null,
  to_location       text not null,

  -- contacts --------------------------------------------------------------
  shipper_contact   jsonb not null default '{}'::jsonb,   -- {name,email,phone}
  recipient_contact jsonb not null default '{}'::jsonb,   -- {name,email,phone}
  -- flat/searchable duplicates the old controller also wrote
  shipper_name      text not null default '',
  shipper_email     citext,
  shipper_phone     text not null default '',
  recipient_name    text not null default '',
  recipient_phone   text not null default '',
  recipient_email   citext,
  recipient_address text not null default '',

  -- sub-documents ---------------------------------------------------------
  parcel            jsonb,   -- {weight,length,width,height,contents,value,level}
  freight           jsonb,   -- {mode,pallets,length,width,height,weight,incoterm,notes}

  -- quote snapshot --------------------------------------------------------
  currency          text not null default 'EUR',
  list_price        numeric(12,2) not null default 0,  -- before discount
  discount_amount   numeric(12,2) not null default 0,
  price             numeric(12,2) not null default 0,  -- payable total
  eta               text not null default '',
  eta_at            timestamptz,
  billable          numeric(12,3) not null default 0,  -- chargeable kg

  -- tracking --------------------------------------------------------------
  tracking_number   text not null unique,
  status            text not null default 'CREATED' check (status in (
                      'CREATED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY',
                      'DELIVERED','EXCEPTION','CANCELLED')),
  last_location     text not null default '',
  timeline          jsonb not null default '[]'::jsonb,  -- [{status,at,note}]

  -- files -----------------------------------------------------------------
  label_urls        jsonb not null default '[]'::jsonb,
  proof_urls        jsonb not null default '[]'::jsonb,
  goods_photos      jsonb not null default '[]'::jsonb,  -- string[]
  goods_photos_meta jsonb not null default '[]'::jsonb,  -- [{url,name,size,...}]
  goods_videos      jsonb not null default '[]'::jsonb,
  goods_videos_meta jsonb not null default '[]'::jsonb,

  -- opaque key linking the browser draft/uploads to the saved shipment ----
  shipment_key      text not null default '',

  -- payment ---------------------------------------------------------------
  payment_method    text not null default '' check (payment_method in ('card','cod','payInPerson','')),
  payment_status    text not null default '',
  promo_code        text not null default '',
  test_booking      boolean not null default false,

  idempotency_key   text unique,
  meta              jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists shipments_status_created_idx   on public.shipments (status, created_at desc);
create index if not exists shipments_user_created_idx     on public.shipments (user_id, created_at desc);
create index if not exists shipments_admin_created_idx    on public.shipments (assigned_admin_id, created_at desc);
create index if not exists shipments_tracking_idx         on public.shipments (tracking_number);
create index if not exists shipments_shipment_key_idx     on public.shipments (shipment_key);
create index if not exists shipments_recipient_email_idx  on public.shipments (recipient_email);
create index if not exists shipments_shipper_email_idx    on public.shipments (shipper_email);
create index if not exists shipments_routing_code_idx     on public.shipments (routing_code);
create index if not exists shipments_test_booking_idx     on public.shipments (test_booking);

drop trigger if exists shipments_touch on public.shipments;
create trigger shipments_touch before update on public.shipments
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- user_details  (was: userDetails.model.js)
-- The Mongo doc embedded arrays of sub-documents and the dashboard mutates
-- them by array index, so they stay as jsonb arrays here. Same shape, same
-- index semantics — no rewrite needed on the client.
-- ===========================================================================
create table if not exists public.user_details (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  display_name       text,
  email              citext,
  phone              text,
  roles              text[] not null default array['customer']::text[],

  shipments          jsonb not null default '[]'::jsonb,  -- denormalised ShipmentLite rows
  addresses          jsonb not null default '[]'::jsonb,
  payment_methods    jsonb not null default '[]'::jsonb,
  pickups            jsonb not null default '[]'::jsonb,
  quotes             jsonb not null default '[]'::jsonb,
  support_tickets    jsonb not null default '[]'::jsonb,

  notification_prefs jsonb not null default
    '{"email":true,"sms":false,"whatsapp":false,"pickup":true,"transit":true,"delivered":true,"delays":true,"promos":false}'::jsonb,
  profile            jsonb not null default '{"accountType":"individual","loyaltyTier":"Bronze"}'::jsonb,
  billing            jsonb not null default
    '{"currency":"EUR","totalSpend":0,"deliveredCount":0,"inTransitCount":0,"exceptionCount":0,"byMonth":[],"walletBalance":0}'::jsonb,
  admin_overlay      jsonb not null default '{"active":false}'::jsonb,
  meta               jsonb not null default '{"source":"user"}'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists user_details_touch on public.user_details;
create trigger user_details_touch before update on public.user_details
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- admin_mock_overlays  (was: src/lib/mockStore.js — an in-memory Map)
-- ===========================================================================
create table if not exists public.admin_mock_overlays (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  bundle     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_mock_touch on public.admin_mock_overlays;
create trigger admin_mock_touch before update on public.admin_mock_overlays
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Support chat (ChatWidget.tsx + AdminDashboard already talk to these names)
-- ===========================================================================
create table if not exists public.ge_conversations (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  email        text,
  ip           text,
  city         text,
  region       text,
  country      text,
  country_code text,
  timezone     text,
  first_page   text,
  user_agent   text,
  last_message text,
  status       text not null default 'open' check (status in ('open','closed','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ge_conversations_created_idx on public.ge_conversations (created_at desc);

drop trigger if exists ge_conversations_touch on public.ge_conversations;
create trigger ge_conversations_touch before update on public.ge_conversations
  for each row execute function public.touch_updated_at();

create table if not exists public.ge_messages_raw (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ge_conversations(id) on delete cascade,
  sender          text not null check (sender in ('visitor','admin')),
  text            text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists ge_messages_conv_idx on public.ge_messages_raw (conversation_id, created_at);

-- realtime for the live chat
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ge_messages_raw'
  ) then
    execute 'alter publication supabase_realtime add table public.ge_messages_raw';
  end if;
end$$;
