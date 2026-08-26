// supabase/functions/auth-email/index.ts
//
// SUPABASE AUTH "SEND EMAIL" HOOK
//
// Takes signup / login / password-reset emails away from Supabase's built-in
// sender and puts them through Resend, from YOUR address, with YOUR templates —
// the same arrangement Ridgeford uses, adapted to a project that keeps
// Supabase Auth (and therefore RLS on auth.uid()).
//
// Why this matters beyond branding: Supabase's built-in SMTP is rate limited
// to a couple of emails per hour on the free tier and frequently only delivers
// to the project owner's address. That is the usual reason signup "does
// nothing" — the account is created, the code never arrives.
//
// Secrets:
//   RESEND_API_KEY        re_xxx
//   MAIL_FROM             "Envoy Courier <noreply@envoyservices.com>"
//   MAIL_REPLY_TO         support@envoyservices.com        (optional)
//   APP_URL               https://www.shipenvoy.com
//   SEND_EMAIL_HOOK_SECRET  v1,whsec_...  (copy from the hook settings page)
//
// Deploy WITHOUT jwt verification — Supabase calls this itself, not a user:
//   npx supabase functions deploy auth-email --no-verify-jwt

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;

const RESEND_API_KEY = env("RESEND_API_KEY");
const MAIL_FROM = env("MAIL_FROM", "Envoy Courier <onboarding@resend.dev>");
const MAIL_REPLY_TO = env("MAIL_REPLY_TO");
const APP_URL = env("APP_URL", "https://www.shipenvoy.com").replace(/\/+$/, "");
const HOOK_SECRET = env("SEND_EMAIL_HOOK_SECRET");
const BRAND_NAME = env("BRAND_NAME", "Envoy");
const BRAND_ADDRESS = env("BRAND_ADDRESS", "Envoy Logistics");

/* --------------------------------------------------------------------------
   Email brand
   Deliberately on paper, not on the app's dark UI. Dark-background HTML email
   is a known mess: Gmail and Outlook partially invert it, dark-mode clients
   invert it again, and the result is unreadable in a way you cannot test for.
   -------------------------------------------------------------------------- */
const C = {
  accent: "#0F9D6E",     // Envoy green, darkened for contrast on white
  accentDeep: "#0A7A55",
  ink900: "#0F172A",
  ink600: "#475569",
  ink400: "#94A3B8",
  hair: "#E2E8F0",
  paper: "#F1F5F9",
};

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 600px table layout, inline CSS, system fonts — the rules email clients need. */
function shell({ title, preheader, inner }: {
  title: string; preheader: string; inner: string;
}) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">

  <tr><td style="padding:22px 28px;border-bottom:1px solid ${C.hair};">
    <span style="font-size:17px;font-weight:800;letter-spacing:-0.02em;color:${C.ink900};">${esc(BRAND_NAME)}</span>
    <span style="font-size:11px;font-weight:700;color:${C.ink400};letter-spacing:0.14em;text-transform:uppercase;margin-left:10px;">Courier &amp; Freight</span>
  </td></tr>

  <tr><td style="padding:30px 28px 28px;">${inner}</td></tr>

  <tr><td style="padding:18px 28px 26px;border-top:1px solid ${C.hair};">
    <p style="margin:0;font-size:12px;line-height:1.6;color:${C.ink400};">
      ${esc(BRAND_ADDRESS)}<br>
      This is an automated message${MAIL_REPLY_TO ? ` — replies go to <a href="mailto:${MAIL_REPLY_TO}" style="color:${C.accent};text-decoration:none;">${MAIL_REPLY_TO}</a>` : ""}.
    </p>
  </td></tr>

</table></td></tr></table></body></html>`;
}

/** The code block. Spaced "123 456" — easier to read and retype. */
function codeBlock(token: string) {
  const safe = String(token || "").replace(/\D/g, "").slice(0, 6);
  const display = safe.length === 6 ? `${safe.slice(0, 3)} ${safe.slice(3)}` : safe || token;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
    <tr><td style="background:${C.paper};border:1px solid ${C.hair};border-radius:12px;padding:18px 26px;">
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.14em;color:${C.ink900};">${esc(display)}</div>
    </td></tr>
  </table>`;
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
    <tr><td style="background:${C.accent};border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;font-weight:800;letter-spacing:-0.02em;color:${C.ink900};">${esc(t)}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${C.ink600};">${t}</p>`;
const small = (t: string) =>
  `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${C.ink400};">${t}</p>`;

type Action =
  | "signup" | "magiclink" | "recovery" | "invite"
  | "email_change" | "email_change_current" | "email_change_new";

function build(action: Action, token: string, link: string) {
  switch (action) {
    case "recovery":
      return {
        subject: `Reset your ${BRAND_NAME} password`,
        html: shell({
          title: "Reset your password",
          preheader: "Your password reset code is inside.",
          inner:
            h1("Reset your password") +
            p("Enter this code to set a new password. It expires in 60 minutes.") +
            codeBlock(token) +
            (link ? button(link, "Reset password") : "") +
            small("If you didn't ask to reset your password, ignore this email — nothing changes."),
        }),
      };

    case "magiclink":
      return {
        subject: `Your ${BRAND_NAME} sign-in code`,
        html: shell({
          title: "Sign in",
          preheader: "Your sign-in code is inside.",
          inner:
            h1("Your sign-in code") +
            p("Enter this code to finish signing in. It expires in 60 minutes.") +
            codeBlock(token) +
            (link ? button(link, "Sign in") : "") +
            small("Didn't try to sign in? Ignore this email and your account stays as it is."),
        }),
      };

    case "invite":
      return {
        subject: `You've been invited to ${BRAND_NAME}`,
        html: shell({
          title: "You're invited",
          preheader: "Set up your account.",
          inner:
            h1("You've been invited") +
            p(`Use this code to set up your ${esc(BRAND_NAME)} account.`) +
            codeBlock(token) +
            (link ? button(link, "Accept invitation") : ""),
        }),
      };

    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return {
        subject: `Confirm your new email address`,
        html: shell({
          title: "Confirm your email change",
          preheader: "Confirm the change to your email address.",
          inner:
            h1("Confirm your new email") +
            p("Enter this code to confirm the change to your account's email address.") +
            codeBlock(token) +
            small("If you didn't request this, contact us — your account may need attention."),
        }),
      };

    case "signup":
    default:
      return {
        subject: `Confirm your ${BRAND_NAME} account`,
        html: shell({
          title: "Confirm your account",
          preheader: "Your verification code is inside.",
          inner:
            h1("Confirm your email") +
            p("Enter this code in the app to finish creating your account. It expires in 60 minutes.") +
            codeBlock(token) +
            (link ? button(link, "Confirm email") : "") +
            p(`Once you're in you can book collections, track shipments end to end, and message the team handling your parcel.`) +
            small("Didn't create an account? Ignore this email and nothing happens."),
        }),
      };
  }
}

/* -------------------------------------------------------------------------- */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const raw = await req.text();

  // Verify this really came from Supabase Auth, not from the open internet.
  if (HOOK_SECRET) {
    try {
      const secret = HOOK_SECRET.replace(/^v1,\s*whsec_/, "");
      const wh = new Webhook(secret);
      wh.verify(raw, {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      });
    } catch (e) {
      console.error("[auth-email] signature rejected:", (e as Error).message);
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }
  } else {
    console.warn("[auth-email] SEND_EMAIL_HOOK_SECRET not set — accepting unverified request");
  }

  try {
    const payload = JSON.parse(raw);
    const to = payload?.user?.email as string;
    const d = payload?.email_data ?? {};
    const action = (d.email_action_type ?? "signup") as Action;
    const token = String(d.token ?? "");

    // A clickable confirm link as well as the code — some people click.
    const base = (d.site_url || APP_URL).replace(/\/+$/, "");
    const link = d.token_hash
      ? `${base}/auth/v1/verify?token=${d.token_hash}&type=${action}&redirect_to=${encodeURIComponent(d.redirect_to || APP_URL)}`
      : "";

    if (!to) {
      return new Response(JSON.stringify({ error: "No recipient" }), { status: 400 });
    }

    const { subject, html } = build(action, token, link);

    if (!RESEND_API_KEY) {
      // No provider configured: log the code so local signup still works.
      console.log(`[auth-email:dev] ${action} code for ${to}: ${token}`);
      return new Response(JSON.stringify({}), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        subject,
        html,
        ...(MAIL_REPLY_TO ? { reply_to: MAIL_REPLY_TO } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = (err as { message?: string })?.message ?? `Resend ${res.status}`;
      console.error("[auth-email] resend failed:", message);
      // Returning an error tells Supabase the email did not go out, so the
      // client sees a real failure instead of a silent dead end.
      return new Response(
        JSON.stringify({ error: { http_code: 502, message } }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({}), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[auth-email]", e);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: (e as Error).message } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
