-- ============================================================================
-- Envoy — shared geocode cache
--
-- The browser-only geocoder could not cover the world:
--   * the bundled city DB is ~63k CITY-level entries ("City, CC") — no
--     streets, no small towns, and it needs a recognisable country
--   * Nominatim from a browser cannot send an identifying User-Agent (their
--     usage policy requires one), is throttled to ~1 req/sec, and every
--     visitor re-queries the same places from scratch
--
-- This table is the shared memory: the first person to look up "Onitsha,
-- Nigeria" pays the network cost, everyone after that gets a Postgres hit.
-- Writes happen in the `geocode` Edge Function using the service role.
-- ============================================================================

set search_path = public, extensions;

create table if not exists public.geocodes (
  query_norm  text primary key,          -- lowercased, whitespace-collapsed
  query_raw   text not null default '',
  lat         double precision,
  lon         double precision,
  display     text,                      -- provider's formatted address
  precision   text not null default 'unknown'
                check (precision in ('address','street','city','region','country','unknown')),
  provider    text not null default 'nominatim',
  found       boolean not null default true,   -- false = negative cache
  hits        integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists geocodes_found_idx   on public.geocodes (found);
create index if not exists geocodes_updated_idx on public.geocodes (updated_at desc);

drop trigger if exists geocodes_touch on public.geocodes;
create trigger geocodes_touch before update on public.geocodes
  for each row execute function public.touch_updated_at();

alter table public.geocodes enable row level security;

-- Nobody reads the table directly; the RPC below is the only door, so the
-- cache can't be scraped as a bulk dataset.
drop policy if exists geocodes_admin_all on public.geocodes;
create policy geocodes_admin_all on public.geocodes
  for all to authenticated
  using (public.is_admin_all())
  with check (public.is_admin_all());

grant select, insert, update, delete on public.geocodes to authenticated;

-- ---------------------------------------------------------------------------
-- Read one cached result. Cheap Postgres round-trip — the client tries this
-- before paying for an Edge Function invocation.
--
-- Negative results (found = false) are cached for 7 days so a typo doesn't
-- hammer the upstream provider, then expire so genuine new places get retried.
-- ---------------------------------------------------------------------------
create or replace function public.geocode_cached(p_q text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := lower(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')));
  r public.geocodes%rowtype;
begin
  if v_key = '' then
    return null;
  end if;

  select * into r from public.geocodes where query_norm = v_key;
  if not found then
    return null;
  end if;

  -- expire stale misses so new/renamed places get another chance
  if not r.found and r.updated_at < now() - interval '7 days' then
    return null;
  end if;

  update public.geocodes set hits = hits + 1 where query_norm = v_key;

  if not r.found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found',     true,
    'lat',       r.lat,
    'lon',       r.lon,
    'display',   r.display,
    'precision', r.precision,
    'provider',  r.provider,
    'cached',    true
  );
end;
$$;

revoke all on function public.geocode_cached(text) from public;
grant execute on function public.geocode_cached(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin view: what is being searched, and what is failing. Useful for
-- spotting routes customers want that you cannot resolve.
-- ---------------------------------------------------------------------------
create or replace function public.geocode_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'total',      (select count(*) from public.geocodes),
    'resolved',   (select count(*) from public.geocodes where found),
    'failed',     (select count(*) from public.geocodes where not found),
    'total_hits', (select coalesce(sum(hits), 0) from public.geocodes),
    'top_misses', (select coalesce(jsonb_agg(q), '[]'::jsonb) from (
                     select jsonb_build_object('query', query_raw, 'hits', hits) as q
                     from public.geocodes where not found
                     order by hits desc limit 20) t)
  )
  where public.is_admin();
$$;

revoke all on function public.geocode_stats() from public;
grant execute on function public.geocode_stats() to authenticated;
