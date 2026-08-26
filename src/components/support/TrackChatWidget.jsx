// src/components/support/TrackChatWidget.jsx
//
// Floating chat for ONE shipment. Appears only when a tracking result is on
// screen, and takes the corner from the site-wide ChatWidget while it's there.
//
// Two things make it different from a generic support bubble:
//   * it carries the tracking number, so the customer never repeats it and the
//     team sees the shipment immediately
//   * it routes to whichever admin owns that shipment — a booking made with
//     the "blaise" code reaches Blaise and nobody else
//
// The panel header is built as a miniature waybill: monospace tracking number,
// live status dot, and a perforated tear edge along the bottom. Shipping
// labels are the one artifact every customer in this flow already recognises,
// so the chat looks like it belongs to the parcel rather than to the website.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../libs/supabaseClient";
import { uploadGoodsFile } from "../../utils/uploads";
import { setTrackChatActive } from "./chatScope";

const keyFor = (t) => `envoy_track_chat_${t}`;
const seenFor = (t) => `envoy_track_chat_seen_${t}`;

/* Status → dot colour. Uses the shipment's real state, so the widget reads as
   part of the tracking page rather than a bolted-on chat. */
const STATUS_TONE = {
  CREATED: "#94A3B8",
  PICKED_UP: "#38BDF8",
  IN_TRANSIT: "#38BDF8",
  OUT_FOR_DELIVERY: "#10B981",
  DELIVERED: "#10B981",
  EXCEPTION: "#F59E0B",
  CANCELLED: "#64748B",
};

const STATUS_LABEL = {
  CREATED: "Label created",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  EXCEPTION: "Needs attention",
  CANCELLED: "Cancelled",
};

export default function TrackChatWidget({ tracking, shipmentStatus, from, to }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [unread, setUnread] = useState(0);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  const code = String(shipmentStatus || "CREATED").toUpperCase().replace(/[\s-]+/g, "_");
  const tone = STATUS_TONE[code] || "#94A3B8";
  const label = STATUS_LABEL[code] || code;

  /* ---- claim the corner from the general widget while mounted ---- */
  useEffect(() => {
    setTrackChatActive(true);
    return () => setTrackChatActive(false);
  }, []);

  /* ---- restore this shipment's thread, if there is one ---- */
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;

    const stored = (() => {
      try { return localStorage.getItem(keyFor(tracking)); } catch { return null; }
    })();

    if (!stored) {
      setConversationId(null);
      setMessages([]);
      return;
    }

    (async () => {
      // verify before trusting it — a stale id makes every insert fail with a
      // foreign-key error that surfaces as an unexplained 409
      const { data, error: err } = await supabase.rpc("get_support_conversation", {
        p_id: stored,
      });
      if (cancelled) return;
      if (err || !data) {
        try {
          localStorage.removeItem(keyFor(tracking));
          localStorage.removeItem(seenFor(tracking));
        } catch { /* private mode */ }
        setConversationId(null);
        return;
      }
      setConversationId(stored);
    })();

    return () => { cancelled = true; };
  }, [tracking]);

  /* ---- load history + subscribe to replies ---- */
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("ge_messages_raw")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (cancelled || !data) return;
      setMessages(data);

      const seen = Number(localStorage.getItem(seenFor(tracking)) || 0);
      const admin = data.filter((m) => m.sender === "admin").length;
      setUnread(Math.max(0, admin - seen));
    })();

    const channel = supabase
      .channel(`track-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ge_messages_raw",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // drop our optimistic copy once the real row lands
            const withoutTemp = prev.filter(
              (m) => !(String(m.id).startsWith("temp-") && m.text === msg.text)
            );
            return [...withoutTemp, msg];
          });
          if (msg.sender === "admin") setUnread((u) => u + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, tracking]);

  /* ---- mark read while open ---- */
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    const admin = messages.filter((m) => m.sender === "admin").length;
    try { localStorage.setItem(seenFor(tracking), String(admin)); } catch { /* ignore */ }
  }, [open, messages, tracking]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  /* ---- Esc closes ---- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ensureThread = useCallback(async () => {
    if (conversationId) return conversationId;

    const { data, error: err } = await supabase.rpc("start_support_conversation", {
      payload: {
        name: name || null,
        email: email || null,
        trackingNumber: tracking,
        subject: `Shipment ${tracking}`,
        first_page: typeof window !== "undefined" ? window.location.href : "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });

    if (err || !data) {
      setError("Couldn't start the conversation. Try again in a moment.");
      return null;
    }

    const id = data;
    try { localStorage.setItem(keyFor(tracking), id); } catch { /* private mode */ }
    setConversationId(id);
    return id;
  }, [conversationId, name, email, tracking]);

  async function handleAttach(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const id = await ensureThread();
      if (!id) return;
      const done = [];
      for (const f of files.slice(0, 3)) {
        if (!/^image\//.test(f.type)) { setError("Only images can be attached."); continue; }
        if (f.size > 8 * 1024 * 1024) { setError("Each image must be under 8MB."); continue; }
        const up = await uploadGoodsFile(`support/${id}`, f);
        done.push({ url: up.url, name: up.name, contentType: up.contentType, size: up.size });
      }
      setPending((p) => [...p, ...done]);
    } catch (err) {
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSend() {
    const text = input.trim();
    if ((!text && pending.length === 0) || sending) return;

    setSending(true);
    setError(null);
    setInput("");
    const attachments = pending;

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: "visitor", text, attachments, created_at: new Date().toISOString() },
    ]);

    try {
      const id = await ensureThread();
      if (!id) {
        setInput(text);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      const { error: msgErr } = await supabase.from("ge_messages_raw").insert({
        conversation_id: id,
        sender: "visitor",
        text,
        attachments,
      });

      if (msgErr) {
        // the database guard returns a readable reason (rate limit, length)
        setError(msgErr.message || "Message couldn't be delivered.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text);
        return;
      }

      setPending([]);
      supabase
        .from("ge_conversations")
        .update({ last_message: text || "Sent a photo", status: "open" })
        .eq("id", id)
        .then(() => {}, () => {});
    } finally {
      setSending(false);
    }
  }

  if (!tracking) return null;

  const started = !!conversationId;

  return (
    <>
      <style>{`
        @keyframes envoy-chat-in {
          from { opacity: 0; transform: translateY(14px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes envoy-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: .45; transform: scale(.82); }
        }
        .envoy-chat-panel { animation: envoy-chat-in .22s cubic-bezier(.22,1,.36,1); }
        .envoy-live-dot   { animation: envoy-pulse 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .envoy-chat-panel, .envoy-live-dot { animation: none !important; }
        }
        /* the perforated tear line of a shipping label */
        .envoy-perf {
          height: 1px;
          background-image: radial-gradient(circle, rgba(255,255,255,.34) 1px, transparent 1px);
          background-size: 7px 1px;
          background-repeat: repeat-x;
        }
      `}</style>

      {/* ---------------- Panel ---------------- */}
      {open && (
        <div
          role="dialog"
          aria-label={`Chat about shipment ${tracking}`}
          className="envoy-chat-panel fixed z-50 flex flex-col overflow-hidden
                     inset-x-0 bottom-0 rounded-t-2xl max-h-[86vh]
                     sm:inset-x-auto sm:right-5 sm:bottom-24 sm:w-[382px] sm:rounded-2xl sm:max-h-[calc(100vh-9rem)]"
          style={{
            background: "#0B1220",
            boxShadow: "0 24px 70px -12px rgba(2,6,23,.7)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {/* Waybill header */}
          <div className="px-4 pt-4 pb-3" style={{ background: "#111C2E" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="text-[10px] font-bold uppercase"
                  style={{ letterSpacing: ".18em", color: "#64748B" }}
                >
                  Envoy · Shipment
                </div>
                <div
                  className="mt-1 text-[15px] font-bold truncate"
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    letterSpacing: ".06em",
                    color: "#F1F5F9",
                  }}
                >
                  {tracking}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className="envoy-live-dot inline-block rounded-full"
                    style={{ width: 6, height: 6, background: tone }}
                  />
                  <span className="text-[11px] font-semibold" style={{ color: tone }}>
                    {label}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="shrink-0 rounded-lg p-1.5 focus:outline-none focus-visible:ring-2"
                style={{ color: "#94A3B8" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(from || to) && (
              <div className="mt-2.5 text-[11px] truncate" style={{ color: "#64748B" }}>
                {from} <span style={{ color: "#334155" }}>→</span> {to}
              </div>
            )}
          </div>

          <div className="envoy-perf" />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[180px]">
            {messages.length === 0 && (
              <div className="rounded-xl px-3.5 py-3"
                   style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)" }}>
                <p className="text-[13px] leading-relaxed" style={{ color: "#94A3B8" }}>
                  Ask about this shipment and it goes straight to the team handling it —
                  they can already see the parcel, so there's no need to repeat the number.
                </p>
              </div>
            )}

            {messages.map((m) => {
              const mine = m.sender === "visitor";
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className="max-w-[84%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                    style={
                      mine
                        ? { background: "#10B981", color: "#04120C", borderBottomRightRadius: 6, fontWeight: 500 }
                        : { background: "rgba(255,255,255,.07)", color: "#E2E8F0", borderBottomLeftRadius: 6 }
                    }
                  >
                    {!mine && (
                      <div className="text-[10px] font-bold uppercase mb-1"
                           style={{ letterSpacing: ".14em", color: "#64748B" }}>
                        Envoy team
                      </div>
                    )}
                    {m.text}
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {m.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" title={a.name}>
                            <img src={a.url} alt={a.name || "attachment"}
                                 className="w-[72px] h-[72px] object-cover rounded-lg"
                                 style={{ border: "1px solid rgba(0,0,0,.15)" }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Contact fields, first message only */}
          {!started && (
            <div className="px-4 pb-2 grid grid-cols-2 gap-2">
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                className="rounded-lg px-2.5 py-2 text-[12.5px] focus:outline-none focus-visible:ring-2"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#E2E8F0" }}
              />
              <input
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for replies" type="email"
                className="rounded-lg px-2.5 py-2 text-[12.5px] focus:outline-none focus-visible:ring-2"
                style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#E2E8F0" }}
              />
            </div>
          )}

          {pending.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {pending.map((a, i) => (
                <div key={i} className="relative">
                  <img src={a.url} alt={a.name}
                       className="w-12 h-12 object-cover rounded-lg"
                       style={{ border: "1px solid rgba(255,255,255,.12)" }} />
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    aria-label="Remove photo"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[11px] leading-none"
                    style={{ background: "#0B1220", color: "#E2E8F0", border: "1px solid rgba(255,255,255,.2)" }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="px-4 pb-1.5 text-[11.5px]" style={{ color: "#FCA5A5" }}>{error}</p>
          )}

          {/* Composer */}
          <div className="px-3 pb-3 pt-2 flex items-end gap-2"
               style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <input ref={fileRef} type="file" accept="image/*" multiple
                   onChange={handleAttach} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Attach a photo — useful for damage or a wrong item"
              aria-label="Attach a photo"
              className="shrink-0 rounded-xl p-2.5 disabled:opacity-40 focus:outline-none focus-visible:ring-2"
              style={{ background: "rgba(255,255,255,.06)", color: "#94A3B8" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Message the team…"
              className="flex-1 resize-none rounded-xl px-3 py-2.5 text-[13.5px] focus:outline-none focus-visible:ring-2"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.08)",
                color: "#E2E8F0",
                maxHeight: 110,
              }}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!input.trim() && pending.length === 0)}
              aria-label="Send message"
              className="shrink-0 rounded-xl p-2.5 disabled:opacity-40 focus:outline-none focus-visible:ring-2"
              style={{ background: "#10B981", color: "#04120C" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Bubble ---------------- */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close shipment chat" : `Chat about shipment ${tracking}`}
        className="fixed right-5 bottom-8 md:right-8 md:bottom-10 z-40
                   flex items-center gap-2.5 rounded-full pl-3.5 pr-4 py-3
                   transition-transform duration-200 hover:scale-[1.03] active:scale-95
                   focus:outline-none focus-visible:ring-4"
        style={{
          background: "#0B1220",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 14px 38px -8px rgba(2,6,23,.65)",
          color: "#F1F5F9",
        }}
      >
        {/* parcel mark, ringed in the shipment's own status colour */}
        <span className="relative grid place-items-center rounded-full"
              style={{ width: 26, height: 26, background: "rgba(255,255,255,.06)", boxShadow: `0 0 0 2px ${tone}` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
          </svg>
          {!open && unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full
                             text-[10px] font-bold grid place-items-center"
                  style={{ background: "#F43F5E", color: "#fff" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>

        <span className="text-left leading-tight">
          <span className="block text-[12.5px] font-bold">
            {open ? "Close" : started ? "Your conversation" : "Ask about this parcel"}
          </span>
          <span className="block text-[10px] font-semibold"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: ".05em",
                  color: "#64748B",
                }}>
            {tracking}
          </span>
        </span>
      </button>
    </>
  );
}
