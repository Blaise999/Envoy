-- ============================================================================
-- Envoy — seed the two admins and the shipment discount/routing codes
--
--   1. MAIN admin      -> admin_scope = 'all'      -> sees every shipment
--   2. Blaise          -> admin_scope = 'assigned' -> sees only shipments
--                                                     booked with code "blaise"
--
-- >>> BEFORE RUNNING: set MAIN_ADMIN_EMAIL / MAIN_ADMIN_PASSWORD below to the
-- >>> credentials you already use for /admin/login. If that account should
-- >>> keep its current password, use the "promote an existing account" snippet
-- >>> at the bottom of this file instead of editing these two lines.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: create (or find) an auth user and mark them as an admin.
-- Writing straight into auth.users is the documented way to seed accounts
-- without the service-role key. The column set of auth.identities changes
-- between GoTrue versions, so it is built dynamically.
-- ---------------------------------------------------------------------------
-- citext / pgcrypto live in the `extensions` schema on Supabase, so they must
-- be on the search path for `citext` column types and `::citext` casts to
-- resolve. Every function below repeats this in its own `set search_path`.
set search_path = public, extensions;
create or replace function public.seed_admin_user(
  p_email    text,
  p_password text,
  p_name     text,
  p_scope    text default 'assigned'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id      uuid;
  v_email   text := lower(btrim(p_email));
  v_created boolean := false;
  v_cols    text := '';
  v_vals    text := '';
begin
  select id into v_id from auth.users where email = v_email limit 1;

  if v_id is null then
    v_id := gen_random_uuid();
    v_created := true;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', p_name),
      now(), now(),
      '', '', '', ''
    );

    -- matching identity row (password grant needs it)
    if exists (select 1 from information_schema.columns
                where table_schema='auth' and table_name='identities' and column_name='id') then
      v_cols := 'id, '; v_vals := quote_literal(gen_random_uuid()) || ', ';
    end if;

    v_cols := v_cols || 'user_id, identity_data, provider';
    v_vals := v_vals || quote_literal(v_id) || ', '
                     || quote_literal(jsonb_build_object('sub', v_id::text, 'email', v_email)::text) || ', '
                     || quote_literal('email');

    if exists (select 1 from information_schema.columns
                where table_schema='auth' and table_name='identities' and column_name='provider_id') then
      v_cols := v_cols || ', provider_id';
      v_vals := v_vals || ', ' || quote_literal(v_id::text);
    end if;

    v_cols := v_cols || ', last_sign_in_at, created_at, updated_at';
    v_vals := v_vals || ', now(), now(), now()';

    execute format('insert into auth.identities (%s) values (%s)', v_cols, v_vals);
  end if;

  -- the on_auth_user_created trigger creates the profile; make sure it exists
  -- even when the account predates this migration
  insert into public.profiles (id, name, email, is_verified)
  values (v_id, p_name, v_email, true)
  on conflict (id) do nothing;

  insert into public.user_details (user_id, display_name, email)
  values (v_id, p_name, v_email)
  on conflict (user_id) do nothing;

  update public.profiles
     set role        = 'admin',
         admin_scope = p_scope,
         is_verified = true,
         name        = case when name = '' then p_name else name end
   where id = v_id;

  raise notice 'seed_admin_user: % [%] scope=%',
    v_email, case when v_created then 'created' else 'existing' end, p_scope;

  return v_id;
end;
$$;

-- Reset a seeded admin's password later:
--   select public.reset_admin_password('blaise@envoy.com', 'NewPassword123');
create or replace function public.reset_admin_password(p_email text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where email = lower(btrim(p_email));
  return found;
end;
$$;

revoke all on function public.seed_admin_user(text, text, text, text) from public;
revoke all on function public.reset_admin_password(text, text)        from public;

-- ===========================================================================
-- Run the seed
-- ===========================================================================
do $seed$
declare
  -- >>> EDIT THESE TWO LINES <<<
  MAIN_ADMIN_EMAIL    constant text := 'valadmin@envoy.com';
  MAIN_ADMIN_PASSWORD constant text := 'SET_BEFORE_RUNNING';
  MAIN_ADMIN_NAME     constant text := 'Envoy Operations';

  -- Blaise — the second admin, as requested
  BLAISE_EMAIL    constant text := 'blaise@envoy.com';
  BLAISE_PASSWORD constant text := 'SET_BEFORE_RUNNING';
  BLAISE_NAME     constant text := 'Blaise';

  v_main   uuid;
  v_blaise uuid;
begin
  -- 1. main admin: full visibility over the whole operation
  v_main := public.seed_admin_user(MAIN_ADMIN_EMAIL, MAIN_ADMIN_PASSWORD, MAIN_ADMIN_NAME, 'all');

  -- 2. Blaise: only sees shipments routed to him
  v_blaise := public.seed_admin_user(BLAISE_EMAIL, BLAISE_PASSWORD, BLAISE_NAME, 'assigned');

  -- -------------------------------------------------------------------------
  -- Shipment discount / routing codes
  -- -------------------------------------------------------------------------

  -- "blaise" — the routing code. Any booking that enters this code at
  -- checkout is assigned to Blaise and shows up in his console only.
  --
  -- It is a 0% code out of the box so it never silently changes a price.
  -- To make it a real discount:
  --     update public.discount_codes set percent_off = 15 where code = 'blaise';
  insert into public.discount_codes (
    code, label, percent_off, routes_to_admin_id,
    unlocks_pay_in_person, marks_test_booking, active
  ) values (
    'blaise', 'Blaise — partner bookings', 0, v_blaise, true, false, true
  )
  on conflict (code) do update set
    label                 = excluded.label,
    routes_to_admin_id    = excluded.routes_to_admin_id,
    unlocks_pay_in_person = excluded.unlocks_pay_in_person,
    active                = true;

  -- "011205" — the existing internal test code from BillingPage.jsx:
  -- bypasses the card form, marks the booking as a test, stays with the
  -- main admin.
  insert into public.discount_codes (
    code, label, percent_off, routes_to_admin_id,
    unlocks_pay_in_person, marks_test_booking, active
  ) values (
    '011205', 'Internal test booking', 0, v_main, true, true, true
  )
  on conflict (code) do update set
    label                 = excluded.label,
    routes_to_admin_id    = excluded.routes_to_admin_id,
    unlocks_pay_in_person = excluded.unlocks_pay_in_person,
    marks_test_booking    = excluded.marks_test_booking,
    active                = true;

  -- -------------------------------------------------------------------------
  -- Backfill: existing shipments with no owner go to the main admin, and any
  -- that already carry a routing code go to whoever that code belongs to.
  -- -------------------------------------------------------------------------
  update public.shipments s
     set assigned_admin_id = d.routes_to_admin_id,
         routing_code      = d.code
    from public.discount_codes d
   where lower(btrim(s.promo_code)) = d.code::text
     and s.assigned_admin_id is null;

  update public.shipments
     set assigned_admin_id = v_main
   where assigned_admin_id is null;
end
$seed$;

-- ---------------------------------------------------------------------------
-- Admin self-registration invite code (was ADMIN_INVITE_CODE in the .env)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value)
values ('admin_invite_code', 'let_me_in')
on conflict (key) do nothing;

-- ===========================================================================
-- Alternative: promote an account that already exists (keeps its password)
-- ===========================================================================
--   update public.profiles
--      set role = 'admin', admin_scope = 'all'
--    where email = 'the-email-you-already-log-in-with@example.com';
--
-- Then point the "blaise" code at whichever admin you like:
--   update public.discount_codes
--      set routes_to_admin_id = (select id from public.profiles where email = 'blaise@envoy.com')
--    where code = 'blaise';
