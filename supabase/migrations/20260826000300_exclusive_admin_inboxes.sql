-- ============================================================================
-- Envoy — exclusive admin inboxes
--
-- Before: admin_scope = 'all' was a super-admin bypass, so valadmin saw every
-- shipment including the ones routed to Blaise.
--
-- Now visibility is purely by assignment. Every admin sees exactly the
-- shipments assigned to them:
--
--   valadmin  -> everything with no routing code, plus the "011205"
--                pay-in-person bookings (create_shipment() assigns unrouted
--                bookings to the scope='all' admin)
--   Blaise    -> only bookings made with the "blaise" code
--
-- admin_scope = 'all' still governs ADMINISTRATION — managing discount codes,
-- deleting users, editing roles — just not shipment visibility.
-- ============================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Shipments: read + write strictly by assignment
-- ---------------------------------------------------------------------------
drop policy if exists shipments_select_own on public.shipments;
create policy shipments_select_own on public.shipments
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.is_admin() and assigned_admin_id = auth.uid())
  );

drop policy if exists shipments_update_admin on public.shipments;
create policy shipments_update_admin on public.shipments
  for update to authenticated
  using (public.is_admin() and assigned_admin_id = auth.uid())
  with check (public.is_admin() and assigned_admin_id = auth.uid());

drop policy if exists shipments_delete_admin on public.shipments;
create policy shipments_delete_admin on public.shipments
  for delete to authenticated
  using (public.is_admin() and assigned_admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The update RPC loses its super-admin bypass too, otherwise valadmin could
-- still edit a Blaise shipment by passing its id directly.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_shipment(p_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.shipments;
  v_status text;
  v_next_from text;
  v_next_to text;
  v_note text;
  changes text[] := '{}';
  before_row jsonb;
  after_row  jsonb;
  changed boolean;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select * into s from public.shipments where id = p_id;
  if not found then raise exception 'Shipment not found'; end if;

  -- strictly by assignment now — no scope='all' bypass
  if s.assigned_admin_id is distinct from auth.uid() then
    raise exception 'Forbidden: shipment is not assigned to you';
  end if;

  before_row := jsonb_build_object(
    'status', s.status, 'lastLocation', s.last_location,
    'from', s.from_location, 'to', s.to_location,
    'eta', s.eta, 'etaAt', s.eta_at);

  if p_patch ? 'status' and coalesce(p_patch->>'status','') <> '' then
    v_status := public.normalize_status(p_patch->>'status');
    if v_status is null then
      raise exception 'Invalid status: %', p_patch->>'status';
    end if;
    s.status := v_status;
  end if;

  if p_patch ? 'lastLocation' then s.last_location := btrim(coalesce(p_patch->>'lastLocation','')); end if;
  if p_patch ? 'eta'          then s.eta           := coalesce(p_patch->>'eta',''); end if;
  if p_patch ? 'etaAt'        then s.eta_at        := public.jts(p_patch, 'etaAt'); end if;

  v_next_from := coalesce(p_patch->>'from', p_patch->>'origin');
  v_next_to   := coalesce(p_patch->>'to',   p_patch->>'destination');

  if v_next_from is not null and btrim(v_next_from) is distinct from s.from_location then
    changes := changes || format('Origin: "%s" -> "%s"', s.from_location, btrim(v_next_from));
    s.from_location := btrim(v_next_from);
  end if;
  if v_next_to is not null and btrim(v_next_to) is distinct from s.to_location then
    changes := changes || format('Destination: "%s" -> "%s"', s.to_location, btrim(v_next_to));
    s.to_location := btrim(v_next_to);
  end if;

  v_note := coalesce(
    nullif(p_patch->>'note',''),
    case when coalesce(p_patch->>'lastLocation','') <> ''
         then 'Location: ' || (p_patch->>'lastLocation') end,
    case when array_length(changes,1) > 0 then array_to_string(changes, ' | ') end,
    'Updated by admin');

  s.timeline := coalesce(s.timeline, '[]'::jsonb) || jsonb_build_object(
    'status', s.status,
    'at',     to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'note',   v_note);

  update public.shipments set
    status        = s.status,
    last_location = s.last_location,
    eta           = s.eta,
    eta_at        = s.eta_at,
    from_location = s.from_location,
    to_location   = s.to_location,
    timeline      = s.timeline
  where id = p_id
  returning * into s;

  after_row := jsonb_build_object(
    'status', s.status, 'lastLocation', s.last_location,
    'from', s.from_location, 'to', s.to_location,
    'eta', s.eta, 'etaAt', s.eta_at);

  changed := before_row is distinct from after_row;

  return jsonb_build_object(
    'shipment', to_jsonb(s),
    'changed',  changed,
    'before',   before_row,
    'after',    after_row
  );
end;
$$;

revoke all on function public.admin_update_shipment(uuid, jsonb) from public;
grant execute on function public.admin_update_shipment(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- An admin creating a shipment by hand keeps it, unless a routing code says
-- otherwise. Previously a scope='all' admin's manual bookings were handed to
-- "the main admin", which is now the same thing but stated directly.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_shipment(payload jsonb)
returns public.shipments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row     public.shipments;
  v_service text;
  v_status  text;
  v_admin   uuid;
  v_code    text;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;

  v_service := coalesce(nullif(payload->>'serviceType',''), 'parcel');
  v_status  := coalesce(public.normalize_status(payload->>'status'), 'CREATED');

  v_code := lower(btrim(coalesce(payload->>'promoCode','')));
  if v_code <> '' then
    select routes_to_admin_id into v_admin from public.discount_codes
     where code = v_code::citext and active limit 1;
  end if;

  -- no routing code -> the admin who created it owns it
  if v_admin is null then
    v_admin := auth.uid();
  end if;

  insert into public.shipments (
    user_id, assigned_admin_id, routing_code, service_type,
    from_location, to_location,
    recipient_email, recipient_address, recipient_name,
    parcel, freight,
    currency, list_price, price, eta, status, tracking_number, timeline, promo_code, meta
  ) values (
    nullif(payload->>'userId','')::uuid,
    v_admin,
    nullif(v_code,'')::citext,
    v_service,
    coalesce(nullif(payload->>'from',''), '-'),
    coalesce(nullif(payload->>'to',''),   '-'),
    lower(nullif(payload->>'recipientEmail',''))::citext,
    coalesce(payload->>'recipientAddress',''),
    coalesce(payload->>'toName',''),
    case when v_service = 'parcel'  then payload->'parcel'  else null end,
    case when v_service = 'freight' then payload->'freight' else null end,
    coalesce(nullif(payload->>'currency',''), 'EUR'),
    coalesce(public.jnum(payload, 'price'), 0),
    coalesce(public.jnum(payload, 'price'), 0),
    coalesce(payload->>'eta',''),
    v_status,
    coalesce(nullif(btrim(payload->>'trackingNumber'),''), public.make_tracking_number()),
    jsonb_build_array(jsonb_build_object(
      'status', v_status,
      'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'note', 'Created by admin')),
    coalesce(payload->>'promoCode',''),
    jsonb_build_object('source','admin_console')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_create_shipment(jsonb) from public;
grant execute on function public.admin_create_shipment(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Support threads follow the same rule: your shipments, your conversations.
-- ---------------------------------------------------------------------------
drop policy if exists ge_conversations_select_admin on public.ge_conversations;
create policy ge_conversations_select_admin on public.ge_conversations
  for select to authenticated
  using (public.is_admin() and assigned_admin_id = auth.uid());

drop policy if exists ge_messages_select_scoped on public.ge_messages_raw;
create policy ge_messages_select_scoped on public.ge_messages_raw
  for select to authenticated
  using (
    not public.is_admin()
    or exists (
      select 1 from public.ge_conversations c
      where c.id = ge_messages_raw.conversation_id
        and c.assigned_admin_id = auth.uid()
    )
  );

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
      and c.assigned_admin_id = auth.uid()
      and (p_kind is null or c.kind = p_kind)
    order by coalesce(
      (select max(m.created_at) from public.ge_messages_raw m where m.conversation_id = c.id),
      c.created_at) desc
    limit 100
  ) q;
$$;

revoke all on function public.admin_support_threads(text) from public;
grant execute on function public.admin_support_threads(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Repair: make sure every existing shipment sits with the right admin.
-- ---------------------------------------------------------------------------
update public.shipments s
   set assigned_admin_id = d.routes_to_admin_id,
       routing_code      = d.code
  from public.discount_codes d
 where lower(btrim(s.promo_code)) = d.code::text
   and d.routes_to_admin_id is not null
   and s.assigned_admin_id is distinct from d.routes_to_admin_id;

update public.shipments
   set assigned_admin_id = (
     select id from public.profiles
      where role = 'admin' and admin_scope = 'all'
      order by created_at asc limit 1)
 where assigned_admin_id is null;
