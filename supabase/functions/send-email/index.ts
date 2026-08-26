// supabase/functions/send-email/index.ts
//
// Replaces the two email routes the Express server used to own:
//
//   POST /api/email/send                  -> { mode: "raw",    to, subject, html }
//   POST /api/admin/shipments/:id/notify  -> { mode: "notify", shipmentId, ... }
//
// Only admins may call it: the caller's JWT is verified against public.profiles
// before anything is sent, and a scoped admin can only notify shipments that
// are assigned to them.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   re_xxx
//   EMAIL_FROM       "Envoy Courier <noreply@shipenvoy.com>"
//   SUPPORT_EMAIL    envoymailservices@gmail.com
//   APP_URL          https://www.shipenvoy.com
//   BRAND_NAME       Envoy
//   BRAND_COLOR      #10B981
//   BRAND_ADDRESS    "Envoy Logistics, 21 Wharf Road, London N1 7GS, UK"
//   LOGO_URL         (optional, defaults to APP_URL/envoy.png)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (k: string, fallback = "") => Deno.env.get(k) ?? fallback;

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = env("RESEND_API_KEY");
const EMAIL_FROM = env("EMAIL_FROM", "Envoy Courier <onboarding@resend.dev>");
const SUPPORT_EMAIL = env("SUPPORT_EMAIL", "envoymailservices@gmail.com");
const APP_URL = env("APP_URL", "https://www.shipenvoy.com").replace(/\/+$/, "");
const BRAND_NAME = env("BRAND_NAME", "Envoy");
const BRAND_COLOR = env("BRAND_COLOR", "#10B981");
const BRAND_ADDRESS = env(
  "BRAND_ADDRESS",
  "Envoy Logistics, 21 Wharf Road, London N1 7GS, UK",
);
const LOGO_URL = env("LOGO_URL", `${APP_URL}/envoy.png`);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/* ------------------------------- helpers -------------------------------- */

function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(s = "") {
  return String(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip scripts/handlers, keep a small set of inline tags. */
function sanitizeHtml(input = "") {
  if (!input) return "";
  const allowed = /^<\/?(p|br|strong|b|em|i|u|a|ul|ol|li|span)\b[^>]*>$/i;
  return input
    .replace(/<\s*(script|style|iframe)[^>]*>[\s\S]*?<\s*\/\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "")
    .replace(/<[^>]+>/g, (m) => (allowed.test(m) ? m : ""))
    .replace(/javascript:/gi, "");
}

/** Plain text (or a bare fragment) -> paragraphs. */
function bodyToHtml(body = "") {
  const looksLikeHtml = /<[a-z][^>]*>/i.test(body);
  if (looksLikeHtml) return sanitizeHtml(body);
  return `<p style="margin:0 0 12px;">${
    escapeHtml(body)
      .replace(/\n{2,}/g, '</p><p style="margin:0 0 12px;">')
      .replace(/\n/g, "<br>")
  }</p>`;
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Label created",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Needs attention",
  CANCELLED: "Cancelled",
};

const STATUS_PCT: Record<string, number> = {
  CREATED: 10,
  PICKED_UP: 25,
  IN_TRANSIT: 55,
  OUT_FOR_DELIVERY: 88,
  DELIVERED: 100,
  EXCEPTION: 55,
  CANCELLED: 100,
};

/** The branded shell — one layout for both raw sends and shipment updates. */
function shell({
  subject,
  preheader,
  inner,
}: {
  subject: string;
  preheader?: string;
  inner: string;
}) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,system-ui,'Segoe UI',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
    <tr><td style="padding:24px 28px 20px;background:#ffffff;border-radius:16px 16px 0 0;">
      <img src="${LOGO_URL}" alt="${escapeHtml(BRAND_NAME)}" width="120" height="32"
           style="display:block;border:0;outline:none;text-decoration:none;height:32px;width:auto;max-height:32px;">
    </td></tr>
    <tr><td style="padding:0 28px 28px;background:#ffffff;border-radius:0 0 16px 16px;">
      <div style="font:15px/1.6 -apple-system,system-ui;color:#334155;">${inner}</div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;">
      <p style="margin:0;font:12px/1.5 -apple-system,system-ui;color:#94a3b8;">
        <b style="color:#475569;">${escapeHtml(BRAND_NAME)}</b> &middot; ${escapeHtml(BRAND_ADDRESS)}<br>
        <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR};">${SUPPORT_EMAIL}</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

type Shipment = Record<string, unknown>;

function buildShipmentUpdateEmail(s: Shipment, adminNote: string, changeSummary: string) {
  const status = String(s.status ?? "CREATED").toUpperCase();
  const label = STATUS_LABELS[status] ?? status;
  const pct = STATUS_PCT[status] ?? 40;
  const tracking = String(s.tracking_number ?? "");
  const url = `${APP_URL}/track?ref=${encodeURIComponent(tracking)}`;
  const firstName = String(s.recipient_name ?? "").split(" ")[0] || "there";
  const eta = String(s.eta ?? "") ||
    (s.eta_at ? new Date(String(s.eta_at)).toLocaleDateString() : "");

  const row = (k: string, v: string) =>
    v
      ? `<tr>
          <td style="padding:6px 0;color:#94a3b8;font-size:13px;">${escapeHtml(k)}</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(v)}</td>
        </tr>`
      : "";

  const inner = `
    <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">Shipment update</p>
    <h1 style="margin:0 0 4px;font-size:24px;line-height:1.25;color:#0f172a;">Hi ${escapeHtml(firstName)}, your shipment is ${escapeHtml(label.toLowerCase())}.</h1>
    <p style="margin:0 0 20px;color:#64748b;font-size:14px;">
      Tracking <b style="color:#0f172a;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(tracking)}</b>
    </p>

    <div style="height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:0 0 6px;">
      <div style="height:8px;width:${pct}%;background:${BRAND_COLOR};border-radius:999px;"></div>
    </div>
    <p style="margin:0 0 22px;font-size:12px;color:#94a3b8;">${escapeHtml(changeSummary || label)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:0 0 22px;">
      ${row("From", String(s.from_location ?? ""))}
      ${row("To", String(s.to_location ?? ""))}
      ${row("Last seen", String(s.last_location ?? ""))}
      ${row("Estimated delivery", eta)}
    </table>

    ${
    adminNote
      ? `<div style="border-left:3px solid ${BRAND_COLOR};background:#f8fafc;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 22px;">
           <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;">Note from Operations</p>
           <div style="font-size:14px;color:#334155;">${bodyToHtml(adminNote)}</div>
         </div>`
      : ""
  }

    <a href="${url}"
       style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;
              padding:12px 22px;border-radius:10px;font-weight:700;font-size:14px;">Track shipment</a>
  `;

  const subject = `${label} — ${tracking}`;
  const preheader = changeSummary || adminNote || "Shipment update and live tracking inside.";

  return {
    subject,
    html: shell({ subject, preheader, inner }),
    text: `${label} - ${tracking}\n${
      s.from_location ?? ""
    } -> ${s.to_location ?? ""}\n${adminNote ? adminNote + "\n" : ""}Track: ${url}`,
  };
}

/* -------------------------------- Resend -------------------------------- */

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
) {
  if (!RESEND_API_KEY) {
    console.log("[send-email] no RESEND_API_KEY — preview only:", { to, subject });
    return { ok: true, preview: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
      reply_to: SUPPORT_EMAIL,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { message?: string })?.message ?? `Resend ${res.status}` };
  }
  return { ok: true, id: (data as { id?: string })?.id };
}

/* -------------------------------- handler ------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, admin_scope, name")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? (body.shipmentId ? "notify" : "raw"));

    /* ---------- mode: notify (shipment update email) ---------- */
    if (mode === "notify") {
      const shipmentId = String(body.shipmentId ?? "");
      if (!shipmentId) return json({ error: "shipmentId is required" }, 400);

      const { data: s, error: sErr } = await admin
        .from("shipments")
        .select("*")
        .eq("id", shipmentId)
        .maybeSingle();

      if (sErr || !s) return json({ error: "Shipment not found" }, 404);

      if (profile.admin_scope !== "all" && s.assigned_admin_id !== profile.id) {
        return json({ error: "Forbidden: shipment is not assigned to you" }, 403);
      }

      const to = String(body.to ?? s.recipient_email ?? "").trim();
      if (!to) return json({ error: "No recipient email on this shipment" }, 400);

      const note = String(body.message ?? body.note ?? body.messageMarkdown ?? "").trim();
      const built = buildShipmentUpdateEmail(s, note, String(body.changeSummary ?? ""));
      const subject = String(body.subject ?? "").trim() || built.subject;

      const out = await sendViaResend(to, subject, built.html, built.text);
      if (!out.ok) return json({ error: out.error }, 502);
      return json({ message: "Notification sent", to, preview: out.preview ?? false });
    }

    /* ---------- mode: raw (admin email composer) ---------- */
    const to = String(body.to ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const raw = String(body.html ?? body.body ?? body.message ?? "");

    if (!to || !subject || !raw) {
      return json({ error: "to, subject and html are required" }, 400);
    }

    // the composer already sends a full document; don't wrap it twice
    const alreadyFullDoc = /^\s*(<!doctype|<html\b)/i.test(raw);
    const html = alreadyFullDoc ? raw : shell({ subject, inner: bodyToHtml(raw) });

    const out = await sendViaResend(to, subject, html, stripHtml(html));
    if (!out.ok) return json({ error: out.error }, 502);
    return json({ message: "Email sent successfully", to, preview: out.preview ?? false });
  } catch (e) {
    console.error("[send-email]", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
