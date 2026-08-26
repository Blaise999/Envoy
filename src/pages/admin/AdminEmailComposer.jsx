// src/pages/admin/AdminEmailComposer.jsx
//
// Branded email composer for admins. Lets the admin send a fully-styled
// Envoy email to ANY recipient (not just shipment recipients).
//
// Wraps the user's content in the same Envoy template the system uses
// for shipment updates: real logo, brand colours, mobile-friendly,
// dark-mode aware, clear footer with envoymailservices@gmail.com.
//
// Three modes:
//   - "blank":       free-form announcement
//   - "shipment":    shipment update (status / route / ETA / CTA)
//   - "promo":       promotional message with a single CTA button
//
// Uses POST /api/email/send  (admin-only) with { to, subject, html }.

import React, { useMemo, useState } from "react";
import { adminEmail } from "../../utils/api";

// IMPORTANT: this is the SAME logo URL that the backend email template uses.
// We compute it from the current frontend origin so dev and prod both work.
function logoUrl() {
  if (typeof window === "undefined") return "/envoy.png";
  return `${window.location.origin}/envoy.png`;
}

const SUPPORT_EMAIL = "envoymailservices@gmail.com";

const TEMPLATES = [
  { id: "blank",    label: "Blank announcement", desc: "Free-form message." },
  { id: "shipment", label: "Shipment update",    desc: "Status, route, ETA, tracking link." },
  { id: "promo",    label: "Promotion / news",   desc: "Eye-catcher with a single CTA button." },
];

export default function AdminEmailComposer({ defaultTo = "", defaultSubject = "", onClose, onSent }) {
  const [tab, setTab] = useState("compose"); // compose | preview
  const [template, setTemplate] = useState("blank");
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);

  // Common
  const [headline, setHeadline] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [signOff, setSignOff] = useState("Thanks,\nThe Envoy team");

  // Shipment fields
  const [trackingId, setTrackingId] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [eta, setEta] = useState("");
  const [statusLabel, setStatusLabel] = useState("In transit");
  const [trackUrl, setTrackUrl] = useState("");

  // Promo fields
  const [ctaText, setCtaText] = useState("Get a free quote");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  /* ------------------------------------------------------------------
     Build the HTML email body from the template + fields
  ------------------------------------------------------------------- */
  const html = useMemo(() => {
    const safe = (s) => String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const mdToHtml = (md) =>
      `<p style="margin:0 0 12px;">${
        safe(md).replace(/\n{2,}/g, '</p><p style="margin:0 0 12px;">').replace(/\n/g, "<br>")
      }</p>`;

    const inner =
      template === "shipment" ? buildShipmentInner() :
      template === "promo"    ? buildPromoInner()    :
      buildBlankInner();

    return wrapEnvoyEmail({
      title: subject || "Envoy update",
      preheader: headline || subject || "Envoy update inside.",
      bodyHtml: inner,
    });

    function buildBlankInner() {
      return `
        ${headline ? `<h1 style="margin:0 0 16px;font:900 26px/1.2 -apple-system,system-ui,'Segoe UI',Arial,sans-serif;color:#0f172a;letter-spacing:-0.02em;">${safe(headline)}</h1>` : ""}
        <div style="font:15px/1.6 -apple-system,system-ui,'Segoe UI',Arial,sans-serif;color:#334155;">
          ${mdToHtml(bodyMd)}
          ${signOff ? `<div style="margin-top:18px;color:#475569;">${mdToHtml(signOff)}</div>` : ""}
        </div>
      `;
    }

    function buildShipmentInner() {
      return `
        <p style="margin:8px 0 6px;font:15px/1.5 -apple-system,system-ui;color:#475569;">Hi there,</p>
        <h1 style="margin:4px 0 14px;font:900 24px/1.2 -apple-system,system-ui,'Segoe UI',Arial,sans-serif;color:#0f172a;letter-spacing:-0.02em;">
          ${safe(headline) || `Update on shipment ${safe(trackingId) || "—"}`}
        </h1>

        ${trackingId ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            <tr>
              <td style="padding:6px 12px;background:#f1f5f9;border-radius:999px;font:600 12px Monaco,monospace;color:#334155;">
                ${safe(trackingId)}
              </td>
              <td style="padding-left:8px;">
                <span style="display:inline-block;padding:6px 12px;border-radius:999px;font:700 12px -apple-system,system-ui;background:#10b9811a;color:#059669;text-transform:uppercase;letter-spacing:0.5px;">
                  ${safe(statusLabel)}
                </span>
              </td>
            </tr>
          </table>
        ` : ""}

        ${(origin || destination) ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">
            <tr>
              <td style="font:700 11px -apple-system,system-ui;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">From</td>
              <td></td>
              <td align="right" style="font:700 11px -apple-system,system-ui;color:#64748b;text-transform:uppercase;letter-spacing:1px;padding-bottom:6px;">To</td>
            </tr>
            <tr>
              <td style="font:700 16px -apple-system,system-ui;color:#0f172a;">${safe(origin)}</td>
              <td align="center" style="width:40px;"><span style="color:#10b981;font:700 20px -apple-system,system-ui;">→</span></td>
              <td align="right" style="font:700 16px -apple-system,system-ui;color:#0f172a;">${safe(destination)}</td>
            </tr>
          </table>
        ` : ""}

        ${eta ? `
          <div style="margin:14px 0;padding:14px 16px;background:#f8fafc;border-radius:10px;">
            <div style="font:700 11px -apple-system,system-ui;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Estimated delivery</div>
            <div style="font:800 18px -apple-system,system-ui;color:#0f172a;">${safe(eta)}</div>
          </div>
        ` : ""}

        ${bodyMd ? `<div style="font:15px/1.6 -apple-system,system-ui;color:#334155;margin:14px 0;">${mdToHtml(bodyMd)}</div>` : ""}

        ${trackUrl ? `
          <div style="margin:18px 0;">
            <a href="${safe(trackUrl)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#10b981;color:#ffffff;font:700 15px -apple-system,system-ui;text-decoration:none;">
              Track your shipment →
            </a>
          </div>
        ` : ""}
      `;
    }

    function buildPromoInner() {
      return `
        ${imageUrl ? `<img src="${safe(imageUrl)}" alt="" style="display:block;width:100%;max-width:100%;border-radius:12px;margin:0 0 18px;" />` : ""}

        <h1 style="margin:0 0 12px;font:900 28px/1.15 -apple-system,system-ui,'Segoe UI',Arial,sans-serif;color:#0f172a;letter-spacing:-0.02em;">
          ${safe(headline || "Hello from Envoy")}
        </h1>

        <div style="font:15px/1.6 -apple-system,system-ui;color:#334155;margin:0 0 18px;">
          ${mdToHtml(bodyMd)}
        </div>

        ${ctaText && ctaUrl ? `
          <div style="margin:6px 0 20px;">
            <a href="${safe(ctaUrl)}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#10b981;color:#ffffff;font:800 15px -apple-system,system-ui;text-decoration:none;box-shadow:0 4px 12px rgba(16,185,129,0.25);">
              ${safe(ctaText)}
            </a>
          </div>
        ` : ""}
      `;
    }
  }, [
    template, subject, headline, bodyMd, signOff,
    trackingId, origin, destination, eta, statusLabel, trackUrl,
    ctaText, ctaUrl, imageUrl,
  ]);

  /* ------------------------------------------------------------------
     Send
  ------------------------------------------------------------------- */
  async function send() {
    setErr(""); setInfo("");
    if (!to)      { setErr("Recipient email required."); return; }
    if (!subject) { setErr("Subject required."); return; }

    setSending(true);
    try {
      // adminEmail.send hits POST /api/email/send  (admin JWT required)
      await adminEmail.send({ to, subject, body: html });
      setInfo("Email sent.");
      onSent?.();
      setTimeout(() => onClose?.(), 700);
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  /* ------------------------------------------------------------------
     UI
  ------------------------------------------------------------------- */
  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-slate-900/60 p-2 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-auto flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2 bg-white">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Compose email</div>
            <div className="font-semibold">Send a branded email to any recipient</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">Close</button>
            <button onClick={send} disabled={sending} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:bg-emerald-300">
              {sending ? "Sending…" : "Send email"}
            </button>
          </div>
        </header>

        {(err || info) && (
          <div className={`px-5 py-2 text-sm ${err ? "text-rose-700 bg-rose-50" : "text-emerald-700 bg-emerald-50"} border-b`}>
            {err || info}
          </div>
        )}

        <div className="flex-1 grid lg:grid-cols-2 gap-0 overflow-hidden min-h-0">
          {/* Left: form */}
          <div className="overflow-y-auto p-5 bg-slate-50 border-r">
            {/* Recipient + subject */}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="To" value={to} onChange={setTo} type="email" required />
              <Field label="From" value="Envoy Support" readOnly />
            </div>
            <Field label="Subject" value={subject} onChange={setSubject} required />

            <div className="mt-4">
              <div className="text-xs font-medium text-slate-600 mb-1">Template</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`text-left p-3 rounded-xl border transition ${
                      template === t.id
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <Field label="Headline (optional)" value={headline} onChange={setHeadline} />

              {template === "shipment" && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Tracking ID" value={trackingId} onChange={setTrackingId} placeholder="GE12345678" />
                    <Field label="Status label" value={statusLabel} onChange={setStatusLabel} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Origin" value={origin} onChange={setOrigin} placeholder="Lagos, Nigeria" />
                    <Field label="Destination" value={destination} onChange={setDestination} placeholder="London, UK" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="ETA" value={eta} onChange={setEta} placeholder="May 12, 2026" />
                    <Field label="Tracking URL" value={trackUrl} onChange={setTrackUrl} placeholder="https://www.shipenvoy.com/track?tn=GE12345678" />
                  </div>
                </>
              )}

              {template === "promo" && (
                <>
                  <Field label="Hero image URL (optional)" value={imageUrl} onChange={setImageUrl} placeholder="https://…/banner.jpg" />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Button text" value={ctaText} onChange={setCtaText} />
                    <Field label="Button URL" value={ctaUrl} onChange={setCtaUrl} placeholder="https://www.shipenvoy.com/quote" />
                  </div>
                </>
              )}

              <Textarea label="Message body" rows={8} value={bodyMd} onChange={setBodyMd}
                placeholder="Write your message. A blank line creates a paragraph break." />

              {template !== "promo" && (
                <Textarea label="Sign-off" rows={3} value={signOff} onChange={setSignOff} />
              )}
            </div>

            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
              The email is sent from the address configured in your backend
              (Gmail SMTP if <code>GMAIL_USER</code> + <code>GMAIL_APP_PASSWORD</code> are set,
              else the Resend domain). The Reply-To header is always{" "}
              <span className="font-mono">{SUPPORT_EMAIL}</span>.
            </p>
          </div>

          {/* Right: live preview */}
          <div className="overflow-y-auto bg-slate-100 p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Preview</div>
            <iframe
              title="Email preview"
              className="w-full h-[80vh] rounded-xl border bg-white shadow-sm"
              srcDoc={html}
              sandbox=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Branded email wrapper (matches backend template visually)
   ============================================================ */
function wrapEnvoyEmail({ title, preheader, bodyHtml }) {
  const safe = (s) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${safe(title)}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background:#0f172a !important; }
      .email-card { background:#1e293b !important; color:#e2e8f0 !important; }
      .email-muted { color:#94a3b8 !important; }
    }
    a { text-decoration:none; }
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,system-ui,'Segoe UI',Arial,sans-serif;" class="email-bg">
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">
    ${safe(preheader || "")}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;" class="email-bg">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
          <tr>
            <td style="padding:24px 28px 20px;background:#ffffff;border-radius:16px 16px 0 0;" class="email-card">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logoUrl()}" alt="Envoy"
                         width="120" height="32"
                         style="display:block;border:0;outline:none;text-decoration:none;height:32px;width:auto;max-height:32px;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;background:#ffffff;border-radius:0 0 16px 16px;" class="email-card">
              ${bodyHtml}
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;">
              <p style="margin:0;font:12px/1.5 -apple-system,system-ui;color:#94a3b8;" class="email-muted">
                <b style="color:#475569;">Envoy Logistics Ltd.</b> · 21 Wharf Road, London N1 7GS, UK<br>
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#10b981;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ============================================================
   Primitive form fields
   ============================================================ */
function Field({ label, value = "", onChange, type = "text", placeholder, required, readOnly }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-600 mb-1 mt-3">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${readOnly ? "bg-slate-50 text-slate-500" : "bg-white"}`}
      />
    </label>
  );
}
function Textarea({ label, value = "", onChange, placeholder, rows = 6 }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-600 mb-1 mt-1">{label}</span>}
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
      />
    </label>
  );
}
