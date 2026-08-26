// supabase/functions/otp/index.ts
//
// YOUR OTP, YOUR EMAIL. Supabase Auth never sends a message.
//
// Turn "Confirm email" OFF in Authentication → Providers → Email, and Supabase
// stops emailing entirely. This function issues the codes, stores them hashed,
// and sends them through Resend from your own address — the same arrangement
// Ridgeford uses.
//
// Supabase Auth still holds identity, so auth.uid() and every RLS policy keep
// working. It just has nothing to do with your customers' inboxes.
//
//   POST { action: "request", email, purpose? }        -> issues + emails a code
//   POST { action: "verify",  email, code, purpose? }  -> checks it, marks verified
//
// Secrets:
//   RESEND_API_KEY   re_xxx
//   MAIL_FROM        "Envoy Courier <noreply@envoyservices.com>"
//   MAIL_REPLY_TO    support@envoyservices.com   (optional)
//   OTP_PEPPER       any long random string — codes are HMAC'd with it
//   APP_URL          https://www.shipenvoy.com
//
// Deploy: npx supabase functions deploy otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = env("RESEND_API_KEY");
const MAIL_FROM = env("MAIL_FROM", "Envoy Courier <onboarding@resend.dev>");
const MAIL_REPLY_TO = env("MAIL_REPLY_TO");
const OTP_PEPPER = env("OTP_PEPPER", "envoy-dev-pepper-change-me");
const BRAND_NAME = env("BRAND_NAME", "Envoy");
const BRAND_ADDRESS = env("BRAND_ADDRESS", "Envoy Logistics");

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;          // wrong guesses per code
const MAX_PER_WINDOW = 5;        // codes requested per email per 15 min

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

type Purpose = "signup" | "login" | "password_reset" | "email_change";

/* ------------------------------ code handling ----------------------------- */

function generateOtp() {
  // rejection-free: 6 digits from a crypto source
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

async function hashCode(code: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OTP_PEPPER),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare so a timing side channel can't leak the code. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* -------------------------------- the email ------------------------------- */

const C = {
  accent: "#0F9D6E",
  ink900: "#0F172A",
  ink600: "#475569",
  ink400: "#94A3B8",
  hair: "#E2E8F0",
  paper: "#F1F5F9",
};

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function otpEmail(code: string, purpose: Purpose) {
  const title =
    purpose === "login" ? "Your sign-in code"
      : purpose === "password_reset" ? "Reset your password"
      : purpose === "email_change" ? "Confirm your new email"
      : "Confirm your email";

  const body =
    purpose === "login"
      ? `Enter this code to finish signing in to ${esc(BRAND_NAME)}.`
      : purpose === "password_reset"
      ? "Enter this code to set a new password on your account."
      : purpose === "email_change"
      ? "Enter this code to confirm the change to your account's email address."
      : `Enter this code in the app to finish creating your ${esc(BRAND_NAME)} account.`;

  // Spaced groups: "123 456" is measurably easier to read and retype.
  const display = `${code.slice(0, 3)} ${code.slice(3)}`;

  // Tables + inline CSS + system fonts: what email clients actually render.
  // Paper background, not the app's dark UI — dark HTML email gets inverted by
  // Gmail and Outlook, then inverted again by dark-mode clients.
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${esc(BRAND_NAME)} code is ${display}. It expires in ${TTL_MINUTES} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
  <tr><td style="padding:22px 28px;border-bottom:1px solid ${C.hair};">
    <span style="font-size:17px;font-weight:800;letter-spacing:-0.02em;color:${C.ink900};">${esc(BRAND_NAME)}</span>
    <span style="font-size:11px;font-weight:700;color:${C.ink400};letter-spacing:0.14em;text-transform:uppercase;margin-left:10px;">Courier &amp; Freight</span>
  </td></tr>
  <tr><td style="padding:30px 28px 28px;">
    <h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;font-weight:800;letter-spacing:-0.02em;color:${C.ink900};">${esc(title)}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${C.ink600};">${body}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr><td style="background:${C.paper};border:1px solid ${C.hair};border-radius:12px;padding:18px 26px;">
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.14em;color:${C.ink900};">${display}</div>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${C.ink600};">This code expires in ${TTL_MINUTES} minutes and can only be used once.</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${C.ink400};">Didn't request this? Ignore this email — nothing changes. Never share this code with anyone, including someone claiming to be from ${esc(BRAND_NAME)}.</p>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;border-top:1px solid ${C.hair};">
    <p style="margin:0;font-size:12px;line-height:1.6;color:${C.ink400};">${esc(BRAND_ADDRESS)}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

async function sendMail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[otp:dev] no RESEND_API_KEY — would email ${to}: ${subject}`);
    return { ok: true, dev: true };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject,
      html,
      ...(MAIL_REPLY_TO ? { reply_to: MAIL_REPLY_TO } : {}),
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return { ok: false, error: (e as { message?: string })?.message ?? `Resend ${r.status}` };
  }
  return { ok: true };
}

/* -------------------------------- handler --------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    const purpose = (["signup", "login", "password_reset", "email_change"]
      .includes(body.purpose) ? body.purpose : "signup") as Purpose;

    if (!email || !/.+@.+\..+/.test(email)) {
      return json({ error: "A valid email address is required" }, 400);
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    db.rpc("purge_expired_otps").then(() => {}, () => {});

    /* ---------------------------- request a code --------------------------- */
    if (action === "request") {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count } = await db
        .from("otp_codes")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", since);

      if ((count ?? 0) >= MAX_PER_WINDOW) {
        return json({ error: "Too many codes requested. Try again in a few minutes." }, 429);
      }

      // retire any code still outstanding for this purpose
      await db.from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("email", email).eq("purpose", purpose).is("used_at", null);

      const code = generateOtp();
      await db.from("otp_codes").insert({
        email,
        code_hash: await hashCode(code),
        purpose,
        expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
      });

      const subject =
        purpose === "login" ? `Your ${BRAND_NAME} sign-in code`
          : purpose === "password_reset" ? `Reset your ${BRAND_NAME} password`
          : `Confirm your ${BRAND_NAME} account`;

      const sent = await sendMail(email, subject, otpEmail(code, purpose));
      if (!sent.ok) return json({ error: sent.error }, 502);

      return json({ sent: true, expiresInMinutes: TTL_MINUTES, dev: sent.dev ?? false });
    }

    /* ----------------------------- verify a code --------------------------- */
    if (action === "verify") {
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (code.length !== 6) return json({ error: "Enter the 6-digit code" }, 400);

      const { data: row } = await db
        .from("otp_codes")
        .select("id, code_hash, expires_at, used_at, attempts")
        .eq("email", email).eq("purpose", purpose).is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) return json({ error: "That code has expired. Request a new one." }, 401);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "That code has expired. Request a new one." }, 401);
      }
      if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
        await db.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
        return json({ error: "Too many incorrect attempts. Request a new code." }, 429);
      }

      const ok = safeEqual(await hashCode(code), row.code_hash);
      if (!ok) {
        await db.from("otp_codes")
          .update({ attempts: (row.attempts ?? 0) + 1 })
          .eq("id", row.id);
        return json({ error: "That code isn't right. Check and try again." }, 401);
      }

      await db.from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);

      // flip the app-level verified flag for this address
      const { data: prof } = await db
        .from("profiles").select("id").eq("email", email).maybeSingle();
      if (prof?.id) await db.rpc("mark_email_verified", { p_user_id: prof.id });

      return json({ verified: true, userId: prof?.id ?? null });
    }

    return json({ error: 'action must be "request" or "verify"' }, 400);
  } catch (e) {
    console.error("[otp]", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
