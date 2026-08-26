-- ============================================================================
-- Envoy — own OTP codes (the Ridgeford pattern)
--
-- Supabase Auth is no longer involved in email AT ALL. Turn "Confirm email"
-- OFF in the dashboard and Supabase stops sending anything; this table plus
-- the `otp` Edge Function issue and verify the codes, and Resend delivers
-- them from your own address.
--
-- Supabase Auth still holds identity (so auth.uid() and every RLS policy keep
-- working) — it just never touches your customers' inboxes.
--
-- Mirrors Ridgeford's otp_codes: hashed codes, short TTL, single use, no
-- master code and no environment-gated bypass.
-- ============================================================================

set search_path = public, extensions;

create table if not exists public.otp_codes (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null,
  code_hash  text   not null,          -- HMAC-SHA256(code, OTP_PEPPER)
  purpose    text   not null default 'signup'
               check (purpose in ('signup','login','password_reset','email_change')),
  expires_at timestamptz not null,
  used_at    timestamptz,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists otp_codes_lookup_idx
  on public.otp_codes (email, purpose, created_at desc);
create index if not exists otp_codes_expiry_idx
  on public.otp_codes (expires_at);

-- Only the Edge Function (service role) touches this. Nobody else — a client
-- that could read code_hash could brute-force it offline.
alter table public.otp_codes enable row level security;
revoke all on public.otp_codes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: drop codes that are long dead. Called by the Edge Function on
-- each request, so it needs no scheduler.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_otps()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.otp_codes
   where created_at < now() - interval '24 hours';
$$;

revoke all on function public.purge_expired_otps() from public;

-- ---------------------------------------------------------------------------
-- App-level verification flag.
--
-- With Supabase's own confirmation turned off, auth.users.email_confirmed_at
-- is set the moment the account is created and stops meaning anything. This
-- is the flag that actually tracks whether the person proved they own the
-- address, and it is written only by the Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.mark_email_verified(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
     set is_verified = true
   where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.mark_email_verified(uuid) from public;

-- New accounts start unverified; the seeded admins stay verified.
alter table public.profiles alter column is_verified set default false;

-- ---------------------------------------------------------------------------
-- Let the app read its own verification state without exposing the table.
-- ---------------------------------------------------------------------------
create or replace function public.my_verification_state()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'verified', coalesce((select is_verified from public.profiles where id = auth.uid()), false),
    'email',    (select email from public.profiles where id = auth.uid())
  );
$$;

revoke all on function public.my_verification_state() from public;
grant execute on function public.my_verification_state() to authenticated;
