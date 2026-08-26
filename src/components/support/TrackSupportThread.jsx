// src/components/support/TrackSupportThread.jsx
//
// A support thread scoped to ONE shipment, shown on the tracking page.
//
// Different from the site-wide ChatWidget in two ways:
//   * the thread carries its tracking number, so the admin sees which
//     shipment is being asked about instead of a bare "hi there"
//   * it routes to whichever admin owns that shipment — a question about a
//     "blaise"-coded booking lands in Blaise's inbox, not the general pile
//
// The conversation id is kept per-tracking-number in localStorage, so a
// refresh (or coming back tomorrow) re-opens the same thread.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../libs/supabaseClient";
import { uploadGoodsFile } from "../../utils/uploads";

const keyFor = (tracking) => `envoy_track_support_${tracking}`;

export default function TrackSupportThread({ tracking, shipmentStatus }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState([]);   // attachments staged for the next message
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  /* ---------- restore an existing thread for this tracking number ---------- */
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
      const { data, error: err } = await supabase.rpc("get_support_conversation", {
        p_id: stored,
      });
      if (cancelled) return;
      if (err || !data) {
        // thread was deleted server-side — forget it and start fresh
        try { localStorage.removeItem(keyFor(tracking)); } catch { /* ignore */ }
        setConversationId(null);
        return;
      }
      setConversationId(stored);
    })();

    return () => { cancelled = true; };
  }, [tracking]);

  /* ---------- load messages + subscribe to replies ---------- */
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("ge_messages_raw")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (!cancelled && data) setMessages(data);
    })();

    const channel = supabase
      .channel(`track-support-${conversationId}`)
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
            // drop the optimistic copy of our own message
            if (
              msg.sender === "visitor" &&
              prev.some(
                (m) =>
                  String(m.id).startsWith("temp-") &&
                  m.text === msg.text &&
                  Math.abs(new Date(m.created_at) - new Date(msg.created_at)) < 5000
              )
            ) {
              return prev
                .filter((m) => !String(m.id).startsWith("temp-") || m.text !== msg.text)
                .concat(msg);
            }
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  /* ---------- open the thread on first message ---------- */
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
      setError("Couldn't start the conversation. Please try again.");
      return null;
    }

    const id = data;
    try { localStorage.setItem(keyFor(tracking), id); } catch { /* private mode */ }
    setConversationId(id);
    return id;
  }, [conversationId, name, email, tracking]);

  /* ---------- photo attachments (damage claims, wrong item, etc.) ---------- */
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
        if (!/^image\//.test(f.type)) {
          setError("Only images can be attached.");
          continue;
        }
        if (f.size > 8 * 1024 * 1024) {
          setError("Each image must be under 8MB.");
          continue;
        }
        // reuse the public `goods` bucket, under support/<conversationId>/
        const up = await uploadGoodsFile(`support/${id}`, f);
        done.push({
          url: up.url,
          name: up.name,
          contentType: up.contentType,
          size: up.size,
        });
      }
      setPending((prev) => [...prev, ...done]);
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

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender: "visitor",
        text,
        attachments: pending,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const id = await ensureThread();
      if (!id) {
        setInput(text);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      const { error: msgErr } = await supabase
        .from("ge_messages_raw")
        .insert({
          conversation_id: id,
          sender: "visitor",
          text,
          attachments: pending,
        });

      if (msgErr) {
        // the server-side guard returns a readable reason (rate limit, length)
        setError(msgErr.message || "Message couldn't be delivered.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text);
        return;
      }

      setPending([]);

      supabase
        .from("ge_conversations")
        .update({ last_message: text, status: "open" })
        .eq("id", id)
        .then(() => {}, () => {});
    } finally {
      setSending(false);
    }
  }

  if (!tracking) return null;

  const hasThread = !!conversationId;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
      >
        <span>
          <span className="block text-sm font-semibold text-slate-900">
            Question about this shipment?
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">
            {hasThread
              ? `Your conversation about ${tracking}`
              : `Message the team handling ${tracking}`}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {hasThread && messages.length > 0 && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              {messages.length}
            </span>
          )}
          <span className="text-slate-400 text-lg leading-none">{open ? "−" : "+"}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-200">
          {!hasThread && (
            <div className="px-5 pt-4 grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for replies (optional)"
                type="email"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="px-5 py-4 max-h-80 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Messages here are linked to <b className="font-mono">{tracking}</b>
                {shipmentStatus ? ` (currently ${String(shipmentStatus).toLowerCase()})` : ""},
                so the team can see the shipment straight away — no need to repeat the
                tracking number.
              </p>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={m.sender === "visitor" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm " +
                    (m.sender === "visitor"
                      ? "bg-slate-900 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm")
                  }
                >
                  {m.sender !== "visitor" && (
                    <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                      Envoy Support
                    </div>
                  )}
                  {m.text}
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {m.attachments.map((a, i) => (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          title={a.name}
                        >
                          <img
                            src={a.url}
                            alt={a.name || "attachment"}
                            className="w-20 h-20 object-cover rounded-lg border border-white/20"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <p className="px-5 pb-2 text-xs text-rose-600">{error}</p>
          )}

          {pending.length > 0 && (
            <div className="px-5 pb-2 flex gap-2 flex-wrap">
              {pending.map((a, i) => (
                <div key={i} className="relative">
                  <img
                    src={a.url}
                    alt={a.name}
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-xs leading-none"
                    aria-label="Remove attachment"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 pb-5 flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAttach}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Attach a photo — useful for damage or wrong-item claims"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? "…" : "📎"}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your message…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!input.trim() && pending.length === 0)}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:bg-slate-300"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
