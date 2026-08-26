-- ============================================================================
-- Envoy — business logic (ported from the Express controllers)
--
-- Everything the old server did in Node now lives here as SECURITY DEFINER
-- functions. The browser only ever calls these RPCs, so pricing, tracking
-- numbers and admin routing can't be forged from the client.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Safe JSON casts. The browser sends "" for empty number inputs, which would
-- blow up a direct ::numeric cast, so every read of a client value goes
-- through these.
-- ---------------------------------------------------------------------------
-- citext / pgcrypto live in the `extensions` schema on Supabase, so they must
-- be on the search path for `citext` column types and `::citext` casts to
-- resolve. Every function below repeats this in its own `set search_path`.
set search_path = public, extensions;
create or replace function public.jnum(p jsonb, k text)
returns numeric
language plpgsql
immutable
as $$
begin
  return nullif(btrim(coalesce(p->>k, '')), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.jbool(p jsonb, k text)
returns boolean
language plpgsql
immutable
as $$
begin
  return nullif(btrim(coalesce(p->>k, '')), '')::boolean;
exception when others then
  return null;
end;
$$;

create or replace function public.jts(p jsonb, k text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  return nullif(btrim(coalesce(p->>k, '')), '')::timestamptz;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role helpers (used by every RLS policy)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_role()
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- "super" admin = an admin whose scope is 'all' (sees the whole operation)
create or replace function public.is_admin_all()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and admin_scope = 'all'
  );
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile row (+ user_details row), and back-fill any
-- guest shipments booked earlier with the same email.
-- Replaces findOrCreateUserByContact() from shipment.controller.js.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name  text;
  v_phone text;
begin
  v_name  := coalesce(new.raw_user_meta_data->>'name',
                      new.raw_user_meta_data->>'full_name',
                      split_part(coalesce(new.email,''), '@', 1));
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');

  insert into public.profiles (id, name, email, phone, is_verified)
  values (new.id, v_name, new.email, v_phone, new.email_confirmed_at is not null)
  on conflict (id) do update
    set email = excluded.email,
        name  = case when public.profiles.name = '' then excluded.name else public.profiles.name end;

  insert into public.user_details (user_id, display_name, email, phone)
  values (new.id, v_name, new.email, v_phone)
  on conflict (user_id) do nothing;

  -- adopt guest bookings made with this email before the account existed
  update public.shipments
     set user_id = new.id
   where user_id is null
     and (shipper_email = new.email or recipient_email = new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep profiles.is_verified / email in sync when the user confirms
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
     set email       = new.email,
         is_verified = new.email_confirmed_at is not null,
         last_login  = coalesce(new.last_sign_in_at, public.profiles.last_login)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Tracking numbers  (was: generateTrackingNumber())
-- ---------------------------------------------------------------------------
create or replace function public.make_tracking_number()
returns text
language plpgsql
as $$
declare
  v_code text;
  i int := 0;
begin
  loop
    v_code := 'EV'
      || to_char(now(), 'YYMMDD')
      || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.shipments where tracking_number = v_code);
    i := i + 1;
    if i > 25 then
      v_code := 'EV' || replace(gen_random_uuid()::text, '-', '');
      exit;
    end if;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pricing  (was: calcParcelRate / calcFreightRate in shipment.controller.js)
-- Returns { currency, price, billable, eta }
-- ---------------------------------------------------------------------------
create or replace function public.calc_parcel_rate(p_parcel jsonb, p_level text default 'standard')
returns jsonb
language plpgsql
immutable
as $$
declare
  l numeric := coalesce(public.jnum(p_parcel, 'length'), 0);
  w numeric := coalesce(public.jnum(p_parcel, 'width'),  0);
  h numeric := coalesce(public.jnum(p_parcel, 'height'), 0);
  actual numeric := coalesce(public.jnum(p_parcel, 'weight'), 0);
  vol numeric := 0;
  billable numeric;
  lvl text := lower(coalesce(nullif(p_level, ''), 'standard'));
  base numeric; per_kg numeric; eta text; price numeric;
begin
  if l > 0 and w > 0 and h > 0 then vol := (l * w * h) / 5000.0; end if;
  billable := greatest(actual, vol);

  if lvl = 'priority' then
    base := 24; per_kg := 7.5; eta := '12-48 hours';
  elsif lvl = 'express' then
    base := 18; per_kg := 6.0; eta := '24-72 hours';
  else
    base := 10; per_kg := 4.0; eta := '2-5 business days';
  end if;

  price := greatest(9, ceil(base + billable * per_kg));

  return jsonb_build_object(
    'currency', 'EUR',
    'price',    price,
    'billable', round(billable, 3),
    'eta',      eta
  );
end;
$$;

create or replace function public.calc_freight_rate(p_freight jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  pallets numeric := greatest(coalesce(public.jnum(p_freight, 'pallets'), 1), 1);
  l numeric := coalesce(public.jnum(p_freight, 'length'), 0);
  w numeric := coalesce(public.jnum(p_freight, 'width'),  0);
  h numeric := coalesce(public.jnum(p_freight, 'height'), 0);
  actual numeric := coalesce(public.jnum(p_freight, 'weight'), 0) * pallets;
  mode text := lower(coalesce(nullif(p_freight->>'mode',''), 'air'));
  divisor numeric; vol_per numeric := 0; billable numeric;
  base numeric; per_kg numeric; eta text; price numeric;
begin
  divisor := case when mode = 'air' then 6000 else 5000 end;
  if l > 0 and w > 0 and h > 0 then vol_per := (l * w * h) / divisor; end if;
  billable := greatest(actual, vol_per * pallets);

  if mode = 'air' then
    base := 150; per_kg := 2.2; eta := '2-7 days door-to-door';
  elsif mode = 'sea' then
    base := 90;  per_kg := 1.0; eta := '12-35 days port-to-door';
  else
    base := 120; per_kg := 1.4; eta := '2-10 days door-to-door';
  end if;

  price := greatest(25, ceil(base + billable * per_kg));

  return jsonb_build_object(
    'currency', 'EUR',
    'price',    price,
    'billable', round(billable, 3),
    'eta',      eta
  );
end;
$$;

-- public quote endpoint (was POST /api/shipments/quote)
create or replace function public.quote_shipment(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_parcel  jsonb := payload->'parcel';
  v_freight jsonb := payload->'freight';
begin
  if v_parcel is not null and jsonb_typeof(v_parcel) = 'object' then
    return public.calc_parcel_rate(
      v_parcel,
      coalesce(nullif(payload->>'serviceLevel',''), nullif(v_parcel->>'level',''), 'standard')
    );
  elsif v_freight is not null and jsonb_typeof(v_freight) = 'object' then
    return public.calc_freight_rate(v_freight);
  else
    raise exception 'parcel or freight payload required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Discount / routing codes
-- Public-safe lookup: only tells the caller whether a code is valid and what
-- it does, never lists the codes.
-- ---------------------------------------------------------------------------
create or replace function public.validate_discount_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  r public.discount_codes%rowtype;
begin
  if coalesce(trim(p_code), '') = '' then
    return jsonb_build_object('valid', false, 'reason', 'empty');
  end if;

  select * into r
    from public.discount_codes
   where code = trim(p_code)::citext and active
   limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'valid',              true,
    'code',               r.code::text,
    'label',              r.label,
    'percentOff',         r.percent_off,
    'amountOff',          r.amount_off,
    'unlocksPayInPerson', r.unlocks_pay_in_person,
    'testBooking',        r.marks_test_booking
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Media sanitiser  (was: splitGoodsMedia() in shipment.controller.js)
-- Accepts a jsonb array of strings and/or {url,name,size,contentType} objects
-- and returns { urls: [...], meta: [...] } keeping only http(s) URLs, max 6.
-- ---------------------------------------------------------------------------
create or replace function public.split_goods_media(p_input jsonb, p_kind text default 'photo')
returns jsonb
language plpgsql
immutable
as $$
declare
  item jsonb;
  v_url text;
  urls jsonb := '[]'::jsonb;
  meta jsonb := '[]'::jsonb;
  seen text[] := '{}';
  max_media constant int := 6;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'array' then
    return jsonb_build_object('urls', urls, 'meta', meta);
  end if;

  for item in select * from jsonb_array_elements(p_input) loop
    exit when jsonb_array_length(urls) >= max_media;

    if jsonb_typeof(item) = 'string' then
      v_url := item #>> '{}';
    elsif jsonb_typeof(item) = 'object' then
      v_url := coalesce(item->>'url', item->>'href');
    else
      continue;
    end if;

    if v_url is null or v_url !~* '^https?://' then continue; end if;
    if v_url = any(seen) then continue; end if;
    seen := seen || v_url;

    urls := urls || to_jsonb(v_url);
    meta := meta || jsonb_build_object(
      'url',  v_url,
      'name', coalesce(
                case when jsonb_typeof(item) = 'object' then item->>'name' end,
                case when jsonb_typeof(item) = 'object' then item->>'pathname' end,
                initcap(p_kind)),
      'pathname',    case when jsonb_typeof(item) = 'object' then coalesce(item->>'pathname','') else '' end,
      'size',        case when jsonb_typeof(item) = 'object' then coalesce((item->>'size')::numeric, 0) else 0 end,
      'contentType', case when jsonb_typeof(item) = 'object' then coalesce(item->>'contentType', item->>'type', '') else '' end
    );
  end loop;

  return jsonb_build_object('urls', urls, 'meta', meta);
end;
$$;

-- ---------------------------------------------------------------------------
-- CREATE SHIPMENT
-- Replaces POST /api/shipments and POST /api/shipments/public.
-- Works for both guests (anon key) and signed-in users; auth.uid() decides.
-- Price, tracking number, discount and admin routing are all resolved here.
-- ---------------------------------------------------------------------------
create or replace function public.create_shipment(payload jsonb)
returns public.shipments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_service     text;
  v_from        text;
  v_to          text;
  v_rec_email   text;
  v_rec_addr    text;
  v_parcel      jsonb;
  v_freight     jsonb;
  v_pricing     jsonb;
  v_contact     jsonb;
  v_shipper     jsonb;
  v_recipient   jsonb;
  v_photos      jsonb;
  v_videos      jsonb;
  v_code        text;
  v_disc        public.discount_codes%rowtype;
  v_list_price  numeric := 0;
  v_discount    numeric := 0;
  v_final_price numeric := 0;
  v_admin       uuid;
  v_user        uuid := auth.uid();
  v_idem        text;
  v_pay_method  text;
  v_pay_status  text;
  v_existing    public.shipments;
  v_row         public.shipments;
begin
  ------------------------------------------------------------------ validate
  v_from      := nullif(btrim(coalesce(payload->>'from', '')), '');
  v_to        := nullif(btrim(coalesce(payload->>'to',   '')), '');
  v_rec_email := lower(nullif(btrim(coalesce(payload->>'recipientEmail','')), ''));
  v_rec_addr  := btrim(regexp_replace(coalesce(payload->>'recipientAddress',''), '\s+', ' ', 'g'));

  if v_from is null or v_to is null then
    raise exception 'from and to are required';
  end if;
  if v_rec_email is null then
    raise exception 'recipientEmail is required';
  end if;

  v_parcel  := case when jsonb_typeof(payload->'parcel')  = 'object' then payload->'parcel'  else null end;
  v_freight := case when jsonb_typeof(payload->'freight') = 'object' then payload->'freight' else null end;

  v_service := coalesce(nullif(payload->>'serviceType',''),
                        case when v_freight is not null then 'freight' else 'parcel' end);

  if v_service = 'parcel' and length(v_rec_addr) < 6 then
    raise exception 'recipientAddress is required for parcel shipments (minimum 6 characters)';
  end if;

  -------------------------------------------------------------- idempotency
  v_idem := nullif(btrim(coalesce(payload->>'idempotencyKey','')), '');
  if v_idem is not null then
    select * into v_existing from public.shipments where idempotency_key = v_idem limit 1;
    if found then return v_existing; end if;
  end if;

  ------------------------------------------------------------------ pricing
  if v_service = 'freight' then
    if v_freight is null then raise exception 'freight payload required'; end if;
    v_pricing := public.calc_freight_rate(v_freight);
  else
    if v_parcel is null then raise exception 'parcel payload required'; end if;
    v_pricing := public.calc_parcel_rate(
      v_parcel,
      coalesce(nullif(payload->>'serviceLevel',''), nullif(v_parcel->>'level',''), 'standard')
    );
  end if;
  v_list_price := (v_pricing->>'price')::numeric;

  ------------------------------------------------------- discount + routing
  v_code := lower(btrim(coalesce(payload->>'promoCode', '')));
  v_pay_method := coalesce(payload->>'paymentMethod', '');
  if v_pay_method not in ('card','cod','payInPerson') then v_pay_method := ''; end if;
  v_pay_status := coalesce(payload->>'paymentStatus', '');

  if v_code <> '' then
    select * into v_disc from public.discount_codes
     where code = v_code::citext and active limit 1;

    if found then
      v_discount := least(
        v_list_price,
        round(v_list_price * (v_disc.percent_off / 100.0), 2) + v_disc.amount_off
      );
      v_admin := v_disc.routes_to_admin_id;

      if v_disc.unlocks_pay_in_person then
        v_pay_method := 'payInPerson';
        if v_pay_status = '' then v_pay_status := 'pending_in_person'; end if;
      end if;
    else
      -- unknown code: promo_code still records what was typed (audit trail),
      -- but it routes nowhere and discounts nothing
      v_code := '';
    end if;
  end if;

  v_final_price := greatest(0, v_list_price - v_discount);

  -- no routing code matched -> falls to the main (scope = 'all') admin
  if v_admin is null then
    select id into v_admin
      from public.profiles
     where role = 'admin' and admin_scope = 'all'
     order by created_at asc
     limit 1;
  end if;

  if v_pay_method = 'payInPerson' and v_pay_status = '' then
    v_pay_status := 'pending_in_person';
  end if;

  ----------------------------------------------------------------- contacts
  v_contact := coalesce(payload->'contact', '{}'::jsonb);

  v_shipper := jsonb_build_object(
    'name',  coalesce(nullif(v_contact->>'shipperName',''), nullif(payload->>'shipperName',''), nullif(v_contact->>'name',''), ''),
    'email', lower(coalesce(nullif(v_contact->>'shipperEmail',''), nullif(payload->>'shipperEmail',''), nullif(v_contact->>'email',''), '')),
    'phone', coalesce(nullif(v_contact->>'shipperPhone',''), nullif(payload->>'shipperPhone',''), nullif(v_contact->>'phone',''), '')
  );

  v_recipient := jsonb_build_object(
    'name',  coalesce(nullif(v_contact->>'recipientName',''), nullif(payload->>'recipientName',''), ''),
    'email', v_rec_email,
    'phone', coalesce(nullif(v_contact->>'recipientPhone',''), nullif(payload->>'recipientPhone',''), '')
  );

  -- guest booking: adopt an existing account if the shipper email matches one
  if v_user is null then
    select id into v_user from public.profiles
     where email = nullif(v_shipper->>'email','')::citext limit 1;
  end if;

  -------------------------------------------------------------------- media
  v_photos := public.split_goods_media(
    case
      when jsonb_typeof(payload->'goodsPhotos') = 'array' and jsonb_array_length(payload->'goodsPhotos') > 0
        then payload->'goodsPhotos'
      when jsonb_typeof(payload->'goodsPhotosMeta') = 'array' then payload->'goodsPhotosMeta'
      else '[]'::jsonb
    end, 'photo');

  v_videos := public.split_goods_media(
    case
      when jsonb_typeof(payload->'goodsVideos') = 'array' and jsonb_array_length(payload->'goodsVideos') > 0
        then payload->'goodsVideos'
      when jsonb_typeof(payload->'goodsVideosMeta') = 'array' then payload->'goodsVideosMeta'
      else '[]'::jsonb
    end, 'video');

  ------------------------------------------------------------------- insert
  insert into public.shipments (
    user_id, assigned_admin_id, routing_code, service_type,
    from_location, to_location,
    shipper_contact, recipient_contact,
    shipper_name, shipper_email, shipper_phone,
    recipient_name, recipient_phone, recipient_email, recipient_address,
    parcel, freight,
    currency, list_price, discount_amount, price, eta, billable,
    tracking_number, status, timeline,
    goods_photos, goods_photos_meta, goods_videos, goods_videos_meta,
    shipment_key, payment_method, payment_status, promo_code, test_booking,
    idempotency_key, meta
  ) values (
    v_user,
    v_admin,
    nullif(v_code,'')::citext,
    v_service,
    v_from,
    v_to,
    v_shipper,
    v_recipient,
    coalesce(v_shipper->>'name',''),
    nullif(v_shipper->>'email','')::citext,
    coalesce(v_shipper->>'phone',''),
    coalesce(v_recipient->>'name',''),
    coalesce(v_recipient->>'phone',''),
    v_rec_email::citext,
    v_rec_addr,
    case when v_service = 'parcel' then
      jsonb_strip_nulls(jsonb_build_object(
        'weight',   public.jnum(v_parcel, 'weight'),
        'length',   public.jnum(v_parcel, 'length'),
        'width',    public.jnum(v_parcel, 'width'),
        'height',   public.jnum(v_parcel, 'height'),
        'value',    public.jnum(v_parcel, 'value'),
        'contents', v_parcel->>'contents',
        'level',    coalesce(nullif(payload->>'serviceLevel',''), nullif(v_parcel->>'level',''), 'standard')
      )) else null end,
    case when v_service = 'freight' then
      jsonb_strip_nulls(jsonb_build_object(
        'mode',     lower(coalesce(nullif(v_freight->>'mode',''), 'air')),
        'pallets',  coalesce(public.jnum(v_freight, 'pallets'), 1),
        'length',   public.jnum(v_freight, 'length'),
        'width',    public.jnum(v_freight, 'width'),
        'height',   public.jnum(v_freight, 'height'),
        'weight',   public.jnum(v_freight, 'weight'),
        'incoterm', coalesce(nullif(v_freight->>'incoterm',''), 'DAP'),
        'notes',    v_freight->>'notes'
      )) else null end,
    coalesce(nullif(v_pricing->>'currency',''), 'EUR'),
    v_list_price,
    v_discount,
    v_final_price,
    coalesce(v_pricing->>'eta',''),
    (v_pricing->>'billable')::numeric,
    public.make_tracking_number(),
    'CREATED',
    jsonb_build_array(jsonb_build_object(
      'status', 'CREATED', 'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'note', 'Booking created')),
    v_photos->'urls',
    v_photos->'meta',
    v_videos->'urls',
    v_videos->'meta',
    coalesce(payload->>'shipmentKey', ''),
    v_pay_method,
    v_pay_status,
    coalesce(payload->>'promoCode',''),
    coalesce(public.jbool(payload, 'testBooking'), false) or coalesce(v_disc.marks_test_booking, false),
    v_idem,
    coalesce(payload->'meta', '{}'::jsonb) || jsonb_build_object(
      'source', case when auth.uid() is null then 'web_guest' else 'web_auth' end,
      'contacts', jsonb_build_object('shipper', v_shipper, 'recipient', v_recipient),
      'contact', jsonb_build_object(
        'shipperName',      v_shipper->>'name',
        'shipperEmail',     v_shipper->>'email',
        'shipperPhone',     v_shipper->>'phone',
        'recipientName',    v_recipient->>'name',
        'recipientPhone',   v_recipient->>'phone',
        'recipientEmail',   v_rec_email,
        'recipientAddress', v_rec_addr
      ),
      'shipmentKey', coalesce(payload->>'shipmentKey',''),
      'goodsPhotos', v_photos->'meta'
    )
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC TRACKING  (was: GET /api/shipments/track/:tracking)
-- Only exposes tracking-safe columns; the client formats the timeline.
-- ---------------------------------------------------------------------------
create or replace function public.track_shipment(p_tracking text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  s public.shipments;
begin
  select * into s from public.shipments
   where upper(tracking_number) = upper(btrim(coalesce(p_tracking, '')))
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',                s.id,
    'trackingNumber',    s.tracking_number,
    'status',            s.status,
    'serviceType',       s.service_type,
    'from',              s.from_location,
    'to',                s.to_location,
    'lastLocation',      s.last_location,
    'eta',               s.eta,
    'etaAt',             s.eta_at,
    'timeline',          s.timeline,
    'parcel',            s.parcel,
    'freight',           s.freight,
    'price',             s.price,
    'listPrice',         s.list_price,
    'discountAmount',    s.discount_amount,
    'currency',          s.currency,
    'billable',          s.billable,
    'goodsPhotos',       s.goods_photos,
    'goodsVideos',       s.goods_videos,
    'shipmentKey',       s.shipment_key,
    'shipperContact',    s.shipper_contact,
    'recipientContact',  s.recipient_contact,
    'recipientEmail',    s.recipient_email,
    'recipientAddress',  s.recipient_address,
    'recipientName',     s.recipient_name,
    'recipientPhone',    s.recipient_phone,
    'shipperName',       s.shipper_name,
    'shipperEmail',      s.shipper_email,
    'shipperPhone',      s.shipper_phone,
    'createdAt',         s.created_at,
    'updatedAt',         s.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- ADMIN: update a shipment  (was: PATCH /api/admin/shipments/:id)
-- Normalises the status, appends a timeline entry, reports what changed so
-- the client knows whether to fire a notification email.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_status(p_input text)
returns text
language sql
immutable
as $$
  select case upper(regexp_replace(btrim(coalesce(p_input,'')), '[\s-]+', '_', 'g'))
    when 'CREATED'          then 'CREATED'
    when 'PICKED_UP'        then 'PICKED_UP'
    when 'IN_TRANSIT'       then 'IN_TRANSIT'
    when 'OUT_FOR_DELIVERY' then 'OUT_FOR_DELIVERY'
    when 'DELIVERED'        then 'DELIVERED'
    when 'EXCEPTION'        then 'EXCEPTION'
    when 'CANCELLED'        then 'CANCELLED'
    when 'CANCELED'         then 'CANCELLED'
    else null
  end;
$$;

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

  if not public.is_admin_all() and s.assigned_admin_id is distinct from auth.uid() then
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

-- ---------------------------------------------------------------------------
-- ADMIN: create a shipment by hand (was: POST /api/admin/shipments)
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
  -- a scoped admin creating a shipment keeps it; otherwise it lands with the main admin
  if v_admin is null then
    if public.is_admin_all() then
      select id into v_admin from public.profiles
       where role='admin' and admin_scope='all' order by created_at asc limit 1;
    else
      v_admin := auth.uid();
    end if;
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

-- ---------------------------------------------------------------------------
-- ADMIN: self-service registration guarded by an invite code
-- (was: POST /api/admin/auth/register with ADMIN_INVITE_CODE)
-- Call AFTER supabase.auth.signUp() while signed in as the new user.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

create or replace function public.claim_admin_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_expected text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select value into v_expected from public.app_settings where key = 'admin_invite_code';
  if v_expected is null or v_expected = '' then
    raise exception 'Admin registration is disabled';
  end if;
  if btrim(coalesce(p_code,'')) <> v_expected then
    raise exception 'Invalid invite code';
  end if;

  update public.profiles
     set role = 'admin', admin_scope = 'assigned', is_verified = true
   where id = auth.uid();

  return jsonb_build_object('ok', true, 'role', 'admin');
end;
$$;

-- ---------------------------------------------------------------------------
-- SUPPORT CHAT: open a thread as an anonymous visitor.
--
-- The widget needs the new conversation's id back, but `insert ... returning
-- id` requires SELECT on the table — and visitors must NOT be able to browse
-- the conversation list (it holds other visitors' names, emails and IPs).
-- This SECURITY DEFINER function hands back just the one id instead.
-- ---------------------------------------------------------------------------
create or replace function public.start_support_conversation(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  insert into public.ge_conversations (
    name, email, ip, city, region, country, country_code,
    timezone, first_page, user_agent, last_message, status
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
    'open'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — anon needs the guest-booking + tracking + quote paths only
-- ---------------------------------------------------------------------------
revoke all on function public.create_shipment(jsonb)          from public;
revoke all on function public.track_shipment(text)            from public;
revoke all on function public.quote_shipment(jsonb)           from public;
revoke all on function public.validate_discount_code(text)    from public;
revoke all on function public.admin_update_shipment(uuid, jsonb) from public;
revoke all on function public.admin_create_shipment(jsonb)    from public;
revoke all on function public.claim_admin_invite(text)        from public;
revoke all on function public.start_support_conversation(jsonb) from public;

grant execute on function public.create_shipment(jsonb)       to anon, authenticated;
grant execute on function public.track_shipment(text)         to anon, authenticated;
grant execute on function public.quote_shipment(jsonb)        to anon, authenticated;
grant execute on function public.validate_discount_code(text) to anon, authenticated;
grant execute on function public.admin_update_shipment(uuid, jsonb) to authenticated;
grant execute on function public.admin_create_shipment(jsonb) to authenticated;
grant execute on function public.claim_admin_invite(text)     to authenticated;
grant execute on function public.start_support_conversation(jsonb) to anon, authenticated;
grant execute on function public.is_admin()                   to anon, authenticated;
grant execute on function public.is_admin_all()               to anon, authenticated;
grant execute on function public.jwt_role()                   to anon, authenticated;
grant execute on function public.jnum(jsonb, text)            to anon, authenticated;
grant execute on function public.jbool(jsonb, text)           to anon, authenticated;
grant execute on function public.jts(jsonb, text)             to anon, authenticated;
grant execute on function public.normalize_status(text)       to anon, authenticated;
