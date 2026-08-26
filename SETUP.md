# Envoy — set-up checklist

Everything in order. Roughly 10 minutes.

---

## 1. Point the app at the right project

Open `.env` and confirm it matches the project you're deploying to
(`glihjyunknoczqwayzfa`, not the old one):

    VITE_SUPABASE_URL=https://glihjyunknoczqwayzfa.supabase.co
    VITE_SUPABASE_ANON_KEY=<anon key from Project Settings → API>

## 2. Run the migrations

SQL Editor → paste each file from `supabase/migrations/` → Run.
**In filename order.** All ten:

    20260825000100_schema.sql
    20260825000200_functions.sql
    20260825000300_rls.sql
    20260825000400_seed_admins.sql          ← see note
    20260826000100_geocode_cache.sql
    20260826000200_tracking_support.sql
    20260826000300_exclusive_admin_inboxes.sql
    20260826000400_support_extras.sql
    20260826000500_own_otp.sql
    20260826000600_fix_verification_gate.sql

*Note:* if the admins already exist, skip file 4. If this is a fresh project,
run `RUN_ONCE_seed_admins.sql` from the repo root instead — it has the real
passwords. The version in `migrations/` has them blanked so they aren't
committed to GitHub.

Re-running any file is safe.

## 3. Deploy the functions

    npx supabase functions deploy otp --no-verify-jwt
    npx supabase functions deploy send-email --no-verify-jwt
    npx supabase functions deploy geocode --no-verify-jwt

`--no-verify-jwt` is required, not optional. The gateway's JWT check runs
before the function does, and browsers send no auth headers on a CORS
preflight — leave it on and every OPTIONS request 401s, which the browser
reports as "preflight does not have HTTP ok status".

None of the three rely on the gateway for authorisation: `otp` must be
callable by people who have no account yet (and has its own rate limits),
`send-email` verifies the caller's JWT itself, `geocode` is a public lookup.
`supabase/config.toml` pins this so future deploys keep it.

## 4. Set the secrets

    npx supabase secrets set ^
      RESEND_API_KEY=re_xxx ^
      MAIL_FROM="Envoy Courier <onboarding@resend.dev>" ^
      MAIL_REPLY_TO=support@envoyservices.com ^
      OTP_PEPPER="a-long-random-string-you-invent-once" ^
      APP_URL=https://www.shipenvoy.com ^
      GEOCODE_UA="Envoy/1.0 (valadmin@envoy.com)"

`OTP_PEPPER` is the key your codes are hashed with. Set it once; changing it
invalidates every outstanding code.

Use `onboarding@resend.dev` until `envoyservices.com` is verified in Resend —
it only delivers to your own Resend account address, but it proves the path.
Then swap `MAIL_FROM`; no redeploy needed.

## 5. Build and test

    npm install
    npm run build
    npm run dev

Visit `/diagnostic` first — it probes everything and names anything missing.

---

## What to test

**Signup** — register with a fresh address. No 429. Code arrives from Resend.
Enter it, you're in.

**The code gate** — sign up, ignore the code, try to log in. You should be sent
back to the code screen, not into the dashboard.

**Routing** — book a shipment with promo code `blaise`. Sign in at
`/admin/login`:

| | valadmin@envoy.com / morelife999 | blaise@envoy.com / Blaise999 |
|---|---|---|
| That shipment | not visible | visible |
| Everything else | visible | not visible |

**Tracking chat** — track that shipment. A floating widget appears bottom-right
with the tracking number on it; the site-wide chat bubble steps aside. Send a
message with a photo. It lands in Blaise's inbox with the tracking badge,
shipment status and an unread count.

---

## If something's wrong

`/diagnostic` in the app names the missing piece.

Function failures: Dashboard → Edge Functions → pick the function → Logs. The
reason is in plain text — usually Resend rejecting an unverified sender.

Check the admins and the routing code:

    select email, role, admin_scope, is_verified from public.profiles;
    select code, active,
           (select email from public.profiles p where p.id = d.routes_to_admin_id)
      from public.discount_codes d;

Reset a password without touching any file:

    select public.reset_admin_password('valadmin@envoy.com', 'newpassword');
