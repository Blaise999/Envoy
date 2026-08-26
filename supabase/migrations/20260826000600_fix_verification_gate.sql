-- ============================================================================
-- Envoy — close the verification bypass
--
-- Accounts are now created through the `otp` function's admin API call with
-- email_confirm already true (that is what keeps Supabase's rate-limited
-- mailer out of the path). But two triggers were still deriving
-- profiles.is_verified from auth.users.email_confirmed_at:
--
--   handle_new_user()     set it at creation
--   handle_user_updated() re-synced it on every auth.users update
--
-- So every new account came out already verified, and the OTP step could be
-- skipped entirely — sign up, ignore the code, log straight in.
--
-- With our own OTP, email_confirmed_at is set at creation and means nothing.
-- profiles.is_verified is the real flag and is written in exactly one place:
-- mark_email_verified(), called by the otp function after a correct code.
-- ============================================================================

set search_path = public, extensions;

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

  -- is_verified starts FALSE, always. Only a correct OTP sets it.
  insert into public.profiles (id, name, email, phone, is_verified)
  values (new.id, v_name, new.email, v_phone, false)
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

-- Keep the email and last-login in step, but never touch is_verified.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.profiles
     set email      = new.email,
         last_login = coalesce(new.last_sign_in_at, public.profiles.last_login)
   where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Repair anything already created under the old behaviour: customers who never
-- entered a code are marked unverified so the login gate catches them. Admins
-- are left alone — they are seeded deliberately.
-- ---------------------------------------------------------------------------
update public.profiles p
   set is_verified = false
 where p.role = 'user'
   and p.is_verified
   and not exists (
     select 1 from public.otp_codes o
      where o.email = p.email
        and o.purpose = 'signup'
        and o.used_at is not null
   );
