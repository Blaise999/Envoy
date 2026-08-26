-- ============================================================================
-- Envoy — Row Level Security
--
-- The Express server enforced access with requireAuth(["admin"]) middleware.
-- Postgres now does the same job, so it holds even if someone calls the REST
-- API directly with the anon key.
--
-- The two admin tiers:
--   admin_scope = 'all'      -> the main ops admin, sees the whole operation
--   admin_scope = 'assigned' -> e.g. Blaise, sees only shipments routed to him
-- ============================================================================

-- citext / pgcrypto live in the `extensions` schema on Supabase, so they must
-- be on the search path for `citext` column types and `::citext` casts to
-- resolve. Every function below repeats this in its own `set search_path`.
set search_path = public, extensions;
alter table public.profiles            enable row level security;
alter table public.shipments           enable row level security;
alter table public.user_details        enable row level security;
alter table public.discount_codes      enable row level security;
alter table public.admin_mock_overlays enable row level security;
alter table public.ge_conversations    enable row level security;
alter table public.ge_messages_raw     enable row level security;
alter table public.app_settings        enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- Users may edit their own profile. The role/admin_scope columns are guarded
-- by the trigger below so nobody can promote themselves.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin_all())
  with check (id = auth.uid() or public.is_admin_all());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_admin_all());

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- only a scope='all' admin (or an internal SECURITY DEFINER call) may change
  -- role / admin_scope
  if (new.role is distinct from old.role
      or new.admin_scope is distinct from old.admin_scope)
     and auth.uid() is not null
     and not public.is_admin_all() then
    new.role        := old.role;
    new.admin_scope := old.admin_scope;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- shipments
--   read : own shipments, or admin (scoped)
--   write: admins only; everyone else goes through create_shipment()
-- ---------------------------------------------------------------------------
drop policy if exists shipments_select_own on public.shipments;
create policy shipments_select_own on public.shipments
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin() and (public.is_admin_all() or assigned_admin_id = auth.uid()))
  );

drop policy if exists shipments_update_admin on public.shipments;
create policy shipments_update_admin on public.shipments
  for update to authenticated
  using (public.is_admin() and (public.is_admin_all() or assigned_admin_id = auth.uid()))
  with check (public.is_admin() and (public.is_admin_all() or assigned_admin_id = auth.uid()));

drop policy if exists shipments_delete_admin on public.shipments;
create policy shipments_delete_admin on public.shipments
  for delete to authenticated
  using (public.is_admin_all());

-- deliberately NO insert policy: bookings must go through public.create_shipment()
-- so pricing, tracking numbers and admin routing can't be forged.

-- ---------------------------------------------------------------------------
-- user_details
-- ---------------------------------------------------------------------------
drop policy if exists user_details_select on public.user_details;
create policy user_details_select on public.user_details
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_details_insert on public.user_details;
create policy user_details_insert on public.user_details
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists user_details_update on public.user_details;
create policy user_details_update on public.user_details
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists user_details_delete on public.user_details;
create policy user_details_delete on public.user_details
  for delete to authenticated
  using (public.is_admin_all());

-- ---------------------------------------------------------------------------
-- discount_codes
-- Nobody can list them. Customers check one at a time through
-- public.validate_discount_code(). Only a scope='all' admin manages them.
-- ---------------------------------------------------------------------------
drop policy if exists discount_codes_admin_all on public.discount_codes;
create policy discount_codes_admin_all on public.discount_codes
  for all to authenticated
  using (public.is_admin_all())
  with check (public.is_admin_all());

-- ---------------------------------------------------------------------------
-- admin_mock_overlays
-- ---------------------------------------------------------------------------
drop policy if exists admin_mock_admin_all on public.admin_mock_overlays;
create policy admin_mock_admin_all on public.admin_mock_overlays
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- app_settings — server-side only (SECURITY DEFINER functions read it)
-- ---------------------------------------------------------------------------
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for all to authenticated
  using (public.is_admin_all())
  with check (public.is_admin_all());

-- ---------------------------------------------------------------------------
-- Support chat
-- Visitors are anonymous, so they can open a conversation and post to it, but
-- only staff can browse the conversation list.
-- ---------------------------------------------------------------------------
-- Visitors open a thread through public.start_support_conversation() (which
-- returns the new id without exposing the table), so no anon INSERT policy.

drop policy if exists ge_conversations_update_anyone on public.ge_conversations;
create policy ge_conversations_update_anyone on public.ge_conversations
  for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists ge_conversations_select_admin on public.ge_conversations;
create policy ge_conversations_select_admin on public.ge_conversations
  for select to authenticated
  using (public.is_admin());

drop policy if exists ge_messages_insert_anyone on public.ge_messages_raw;
create policy ge_messages_insert_anyone on public.ge_messages_raw
  for insert to anon, authenticated
  with check (true);

-- NOTE: the widget reads its own thread with the anon key, so anon select is
-- required here. Messages are therefore readable by anyone who knows (or
-- guesses) a conversation UUID. If that matters, move the widget behind
-- Supabase Auth and swap this for `using (false)` plus an RPC.
drop policy if exists ge_messages_select_anyone on public.ge_messages_raw;
create policy ge_messages_select_anyone on public.ge_messages_raw
  for select to anon, authenticated
  using (true);

-- ===========================================================================
-- Table-level GRANTs
--
-- RLS filters ROWS, but a role still needs a table-level privilege to get in
-- the door. Supabase's default privileges usually hand these out automatically
-- for new tables in `public`; granting explicitly means this schema also works
-- on a project where those defaults have been tightened.
--
-- Note what `anon` deliberately does NOT get: profiles, shipments,
-- user_details and discount_codes are invisible to anonymous visitors. Guests
-- book and track through the SECURITY DEFINER RPCs instead.
-- ===========================================================================

grant select, insert, update, delete on public.profiles            to authenticated;
grant select,         update, delete on public.shipments           to authenticated;
grant select, insert, update, delete on public.user_details        to authenticated;
grant select, insert, update, delete on public.discount_codes      to authenticated;
grant select, insert, update, delete on public.admin_mock_overlays to authenticated;
grant select, insert, update, delete on public.app_settings        to authenticated;

-- deliberately no INSERT on shipments: bookings must go through
-- public.create_shipment() so pricing and admin routing can't be forged.

-- support chat: visitors are anonymous
grant update         on public.ge_conversations to anon, authenticated;
grant select         on public.ge_conversations to authenticated;
grant select, insert on public.ge_messages_raw  to anon, authenticated;

-- ============================================================================
-- Storage — goods photos/videos (replaces Vercel Blob)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'goods', 'goods', true, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists goods_public_read on storage.objects;
create policy goods_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'goods');

-- guests book shipments before they have an account, so uploads are open,
-- but only under shipments/<shipmentKey>/... and only into this bucket
drop policy if exists goods_anon_upload on storage.objects;
create policy goods_anon_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'goods' and name like 'shipments/%');

drop policy if exists goods_admin_delete on storage.objects;
create policy goods_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'goods' and public.is_admin());
