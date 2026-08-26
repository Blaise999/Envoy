-- ============================================================================
-- Envoy — tracking-scoped support threads
--
-- Before: every support message landed in one undifferentiated pile, with no
-- way to tell which shipment it was about.
--
-- Now a thread opened from the tracking page carries its tracking number and
-- shipment id, and is ROUTED TO THE SAME ADMIN THAT OWNS THE SHIPMENT — so a
-- question about a "blaise"-coded booking goes to Blaise's inbox, exactly like
-- the shipment itself. General enquiries still go to the main admin.
-- ============================================================================

set search_path = public, extensions;

alter table public.ge_conversations
  add column if not exists tracking_number   text,
  add column if not exists shipment_id       uuid references public.shipments(id) on delete set null,
  add column if not exists assigned_admin_id uuid references public.profiles(id)  on delete set null,
  add column if not exists kind              text not null default 'general'
    check (kind in ('general','tracking')),
  add column if not exists subject           text not null default '';

create index if not exists ge_conversations_tracking_idx on public.ge_conversations (tracking_number);
create index if not exists ge_conversations_shipment_idx on public.ge_conversations (shipment_id);
create index if not exists ge_conversations_admin_idx    on public.ge_conversations (assigned_admin_id, created_at desc);
create index if not exists ge_conversations_kind_idx     on public.ge_conversations (kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Replaces the earlier version: same signature, now understands tracking.
--
-- payload additions:
--   trackingNumber  -> links the thread to that shipment and routes it
--   subject         -> optional short label shown in the admin list
-- ---------------------------------------------------------------------------
create or replace function public.start_support_conversation(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id       uuid;
  v_tracking text := upper(btrim(coalesce(payload->>'trackingNumber', '')));
  v_ship     public.shipments;
  v_admin    uuid;
  v_kind     text := 'general';
  v_subject  text := btrim(coalesce(payload->>'subject', ''));
begin
  if v_tracking <> '' then
    select * into v_ship from public.shipments
     where upper(tracking_number) = v_tracking limit 1;

    if found then
      v_kind  := 'tracking';
      v_admin := v_ship.assigned_admin_id;
      if v_subject = '' then
        v_subject := 'Shipment ' || v_ship.tracking_number;
      end if;
    else
      -- unknown tracking number: keep what they typed, treat as general
      v_tracking := '';
    end if;
  end if;

  -- general enquiries land with the main (scope = 'all') admin
  if v_admin is null then
    select id into v_admin from public.profiles
     where role = 'admin' and admin_scope = 'all'
     order by created_at asc limit 1;
  end if;

  insert into public.ge_conversations (
    name, email, ip, city, region, country, country_code,
    timezone, first_page, user_agent, last_message, status,
    tracking_number, shipment_id, assigned_admin_id, kind, subject
  ) values (
    nullif(btrim(coalesce(payload->>'name','')), ''),
    nullif(btrim(coalesce(payload->>'email','')), ''),
    nullif(payload->>'ip', ''),
    nullif(payload->>'city', ''),
    nullif(payload->>'region', ''),
    nullif(payload->>'country', ''),
    nullif(payload->>'country_code', ''),
    nullif(payload->>'timezone', ''),
    left(coalesce(payload->>'first_page', ''), 500),
    left(coalesce(payload->>'user_agent', ''), 500),
    nullif(payload->>'last_message', ''),
    'open',
    nullif(v_tracking, ''),
    v_ship.id,
    v_admin,
    v_kind,
    v_subject
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.start_support_conversation(jsonb) from public;
grant execute on function public.start_support_conversation(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Resume a thread. The visitor holds the conversation id in localStorage; this
-- confirms it still exists and hands back its context so the tracking page can
-- re-open the right thread after a refresh.
-- ---------------------------------------------------------------------------
create or replace function public.get_support_conversation(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  c public.ge_conversations;
begin
  select * into c from public.ge_conversations where id = p_id;
  if not found then return null; end if;

  -- deliberately narrow: no ip, no email, nothing about other visitors
  return jsonb_build_object(
    'id',             c.id,
    'kind',           c.kind,
    'subject',        c.subject,
    'trackingNumber', c.tracking_number,
    'status',         c.status,
    'createdAt',      c.created_at
  );
end;
$$;

revoke all on function public.get_support_conversation(uuid) from public;
grant execute on function public.get_support_conversation(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: scope the admin inbox the same way shipments are scoped.
-- Blaise sees threads for his shipments; the main admin sees everything.
-- ---------------------------------------------------------------------------
drop policy if exists ge_conversations_select_admin on public.ge_conversations;
create policy ge_conversations_select_admin on public.ge_conversations
  for select to authenticated
  using (
    public.is_admin()
    and (public.is_admin_all() or assigned_admin_id = auth.uid())
  );

-- Messages follow their conversation: a scoped admin only reads threads that
-- are theirs. Anonymous visitors still read their own thread by id.
drop policy if exists ge_messages_select_anyone on public.ge_messages_raw;
create policy ge_messages_select_visitor on public.ge_messages_raw
  for select to anon
  using (true);

drop policy if exists ge_messages_select_scoped on public.ge_messages_raw;
create policy ge_messages_select_scoped on public.ge_messages_raw
  for select to authenticated
  using (
    not public.is_admin()
    or public.is_admin_all()
    or exists (
      select 1 from public.ge_conversations c
      where c.id = ge_messages_raw.conversation_id
        and c.assigned_admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Backfill: existing threads have no owner, so give them to the main admin,
-- otherwise they'd vanish from every inbox once the policy above applies.
-- ---------------------------------------------------------------------------
update public.ge_conversations
   set assigned_admin_id = (
     select id from public.profiles
      where role = 'admin' and admin_scope = 'all'
      order by created_at asc limit 1)
 where assigned_admin_id is null;

-- ---------------------------------------------------------------------------
-- Admin inbox listing, with unread counts and shipment context in one call.
-- ---------------------------------------------------------------------------
create or replace function public.admin_support_threads(p_kind text default null)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(t order by t->>'lastAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',             c.id,
      'kind',           c.kind,
      'subject',        c.subject,
      'trackingNumber', c.tracking_number,
      'shipmentId',     c.shipment_id,
      'shipmentStatus', s.status,
      'shipmentFrom',   s.from_location,
      'shipmentTo',     s.to_location,
      'name',           c.name,
      'email',          c.email,
      'city',           c.city,
      'country',        c.country,
      'status',         c.status,
      'lastMessage',    c.last_message,
      'messageCount',   (select count(*) from public.ge_messages_raw m where m.conversation_id = c.id),
      'lastAt',         coalesce(
                          (select max(m.created_at) from public.ge_messages_raw m where m.conversation_id = c.id),
                          c.created_at),
      'createdAt',      c.created_at
    ) as t
    from public.ge_conversations c
    left join public.shipments s on s.id = c.shipment_id
    where public.is_admin()
      and (public.is_admin_all() or c.assigned_admin_id = auth.uid())
      and (p_kind is null or c.kind = p_kind)
    order by coalesce(
      (select max(m.created_at) from public.ge_messages_raw m where m.conversation_id = c.id),
      c.created_at) desc
    limit 100
  ) q;
$$;

revoke all on function public.admin_support_threads(text) from public;
grant execute on function public.admin_support_threads(text) to authenticated;
