-- ============================================================================
-- Envoy — support extras + admin stats
--
--   1. Photo attachments on support messages (damage claims, wrong item,
--      proof of condition) — the single most useful thing a courier's support
--      thread can carry.
--   2. Unread counts, so the admin inbox shows what actually needs a reply.
--   3. A spam limit on anonymous messages.
--   4. One dashboard-stats call, scoped per admin like everything else.
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Attachments
-- ---------------------------------------------------------------------------
alter table public.ge_messages_raw
  add column if not exists attachments jsonb not null default '[]'::jsonb;
  -- [{ url, name, contentType, size }]

-- ---------------------------------------------------------------------------
-- 2. Unread tracking
-- ---------------------------------------------------------------------------
alter table public.ge_conversations
  add column if not exists admin_last_read_at timestamptz,
  add column if not exists priority           text not null default 'normal'
    check (priority in ('low','normal','high'));

create or replace function public.admin_mark_thread_read(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;

  update public.ge_conversations
     set admin_last_read_at = now()
   where id = p_id
     and assigned_admin_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.admin_mark_thread_read(uuid) from public;
grant execute on function public.admin_mark_thread_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Spam limit — anonymous visitors, so worth a hard stop.
--    Max 10 messages per minute per conversation, and 2000 chars each.
-- ---------------------------------------------------------------------------
create or replace function public.guard_support_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_recent int;
begin
  if length(coalesce(new.text, '')) > 2000 then
    raise exception 'Message too long (max 2000 characters)';
  end if;

  if new.sender = 'visitor' then
    select count(*) into v_recent
      from public.ge_messages_raw
     where conversation_id = new.conversation_id
       and sender = 'visitor'
       and created_at > now() - interval '1 minute';

    if v_recent >= 10 then
      raise exception 'Too many messages — please wait a moment before sending again';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ge_messages_guard on public.ge_messages_raw;
create trigger ge_messages_guard before insert on public.ge_messages_raw
  for each row execute function public.guard_support_message();

-- ---------------------------------------------------------------------------
-- Rebuilt inbox: now carries unread counts, attachment counts and priority.
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
      'priority',       c.priority,
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
      'messageCount',   (select count(*) from public.ge_messages_raw m
                          where m.conversation_id = c.id),
      'unreadCount',    (select count(*) from public.ge_messages_raw m
                          where m.conversation_id = c.id
                            and m.sender = 'visitor'
                            and (c.admin_last_read_at is null
                                 or m.created_at > c.admin_last_read_at)),
      'attachmentCount',(select coalesce(sum(jsonb_array_length(m.attachments)), 0)
                          from public.ge_messages_raw m
                         where m.conversation_id = c.id),
      'lastAt',         coalesce(
                          (select max(m.created_at) from public.ge_messages_raw m
                            where m.conversation_id = c.id),
                          c.created_at),
      'createdAt',      c.created_at
    ) as t
    from public.ge_conversations c
    left join public.shipments s on s.id = c.shipment_id
    where public.is_admin()
      and c.assigned_admin_id = auth.uid()
      and (p_kind is null or c.kind = p_kind)
    order by coalesce(
      (select max(m.created_at) from public.ge_messages_raw m
        where m.conversation_id = c.id), c.created_at) desc
    limit 100
  ) q;
$$;

revoke all on function public.admin_support_threads(text) from public;
grant execute on function public.admin_support_threads(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Dashboard stats — one call, scoped to the calling admin's shipments.
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with mine as (
    select * from public.shipments
     where assigned_admin_id = auth.uid()
  )
  select jsonb_build_object(
    'totalShipments',  (select count(*) from mine),
    'byStatus',        (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                          from (select status, count(*) n from mine group by status) x),
    'activeShipments', (select count(*) from mine
                         where status in ('CREATED','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY')),
    'delivered',       (select count(*) from mine where status = 'DELIVERED'),
    'exceptions',      (select count(*) from mine where status = 'EXCEPTION'),
    'revenue',         (select coalesce(sum(price), 0) from mine where not test_booking),
    'discountGiven',   (select coalesce(sum(discount_amount), 0) from mine),
    'currency',        coalesce((select currency from mine limit 1), 'EUR'),
    'last7Days',       (select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb) from (
                          select jsonb_build_object(
                            'day', to_char(g.day, 'YYYY-MM-DD'),
                            'count', (select count(*) from mine
                                       where created_at::date = g.day),
                            'revenue', (select coalesce(sum(price), 0) from mine
                                         where created_at::date = g.day and not test_booking)
                          ) as d
                          from generate_series(
                            (current_date - interval '6 days')::date,
                            current_date, interval '1 day') g(day)) t),
    'topRoutes',       (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                          select jsonb_build_object(
                            'from', from_location, 'to', to_location, 'count', count(*)) as r
                          from mine
                          group by from_location, to_location
                          order by count(*) desc limit 5) t),
    'unreadSupport',   (select count(*)
                          from public.ge_conversations c
                          join public.ge_messages_raw m on m.conversation_id = c.id
                         where c.assigned_admin_id = auth.uid()
                           and m.sender = 'visitor'
                           and (c.admin_last_read_at is null
                                or m.created_at > c.admin_last_read_at)),
    'openThreads',     (select count(*) from public.ge_conversations
                         where assigned_admin_id = auth.uid() and status = 'open')
  )
  where public.is_admin();
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: support attachments live under support/<conversationId>/ in the
-- existing public `goods` bucket.
-- ---------------------------------------------------------------------------
drop policy if exists goods_anon_upload on storage.objects;
create policy goods_anon_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'goods'
    and (name like 'shipments/%' or name like 'support/%')
  );
