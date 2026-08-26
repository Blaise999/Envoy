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

const keyFor = (tracking) => `envoy_track_support_${tracking}`;

export default function TrackSupportThread({ tracking, shipmentStatus }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
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

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, sender: "visitor", text, created_at: new Date().toISOString() },
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
        .insert({ conversation_id: id, sender: "visitor", text });

      if (msgErr) {
        setError("Message couldn't be delivered. Check your connection.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(text);
        return;
      }

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
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <p className="px-5 pb-2 text-xs text-rose-600">{error}</p>
          )}

          <div className="px-5 pb-5 flex gap-2">
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
              disabled={sending || !input.trim()}
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
