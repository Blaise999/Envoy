// src/components/support/ChatWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Headphones } from "lucide-react";
import { supabase } from "../../libs/supabaseClient";

type ChatMessage = {
  id: string;
  sender: "visitor" | "admin";
  text: string;
  created_at: string;
};

const STORAGE_KEY = "ge_support_conversation_id_v1";
const SEEN_COUNT_KEY = "ge_support_seen_count_v1";

// Single source of truth for the support email
const SUPPORT_EMAIL = "envoymailservices@gmail.com";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [seenAdminCount, setSeenAdminCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(SEEN_COUNT_KEY);
    return raw ? Number(raw) || 0 : 0;
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // restore existing conversation if user has one
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setConversationId(saved);
  }, []);

  // load + subscribe to messages
  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("ge_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!cancelled && !error && data) {
        setMessages(data as ChatMessage[]);
      }
    }

    loadMessages();

    const channel = supabase
      .channel(`ge-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ge_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            // de-dupe optimistic temp messages by text + sender within 5s
            if (
              msg.sender === "visitor" &&
              prev.some(
                (m) =>
                  m.id.startsWith("temp-") &&
                  m.text === msg.text &&
                  Math.abs(
                    new Date(m.created_at).getTime() -
                      new Date(msg.created_at).getTime()
                  ) < 5000
              )
            ) {
              return prev
                .filter(
                  (m) =>
                    !(
                      m.id.startsWith("temp-") &&
                      m.text === msg.text
                    )
                )
                .concat(msg);
            }
            // also de-dupe by id in case the insert event fires twice
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

  // auto-scroll to latest
  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, open]);

  // when opened, mark all admin messages as seen
  useEffect(() => {
    if (open) {
      const adminCount = messages.filter((m) => m.sender === "admin").length;
      setSeenAdminCount(adminCount);
      window.localStorage.setItem(SEEN_COUNT_KEY, String(adminCount));
    }
  }, [open, messages]);

  const totalAdminMessages = messages.filter((m) => m.sender === "admin").length;
  const unreadAdmin = Math.max(0, totalAdminMessages - seenAdminCount);

  async function fetchGeo() {
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipJson = await ipRes.json();
      const ip = ipJson?.ip as string | undefined;
      if (!ip) return {};

      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geo = await geoRes.json();

      return {
        ip,
        city: geo.city as string | undefined,
        region: geo.region as string | undefined,
        country: geo.country_name as string | undefined,
        country_code: geo.country_code as string | undefined,
        timezone: geo.timezone as string | undefined,
      };
    } catch {
      return {};
    }
  }

  async function ensureConversation() {
    if (conversationId) return conversationId;
    setLoading(true);
    setError(null);

    const geo = await fetchGeo();

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        name: name || null,
        email: email || null,
        first_page: window.location.href,
        user_agent: navigator.userAgent,
        status: "open",
        ...geo,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error || !data) {
      console.error("create conversation error", error);
      setError(
        `Couldn't start conversation. Please try again or email ${SUPPORT_EMAIL}.`
      );
      return null;
    }

    const id = data.id as string;
    setConversationId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    const convId = await ensureConversation();
    if (!convId) {
      setSending(false);
      // restore the input so user doesn't lose their message
      setInput(text);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const temp: ChatMessage = {
      id: tempId,
      sender: "visitor",
      text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);

    const { error: msgErr } = await supabase.from("ge_messages").insert({
      conversation_id: convId,
      sender: "visitor",
      text,
    });

    if (msgErr) {
      console.error("send message error", msgErr);
      // mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, text: `${text}  (failed to send)` } : m
        )
      );
      setError(
        "Message couldn't be delivered. Check your connection and try again."
      );
      setInput(text);
    } else {
      // best-effort update last_message; don't block UI on this
      supabase
        .from("conversations")
        .update({ last_message: text, status: "open" })
        .eq("id", convId)
        .then(() => {});
    }

    setSending(false);
  }

  // Cancel conversation entirely — closes it server-side and resets locally.
  async function cancelConversation() {
    if (conversationId) {
      try {
        await supabase
          .from("conversations")
          .update({ status: "cancelled" })
          .eq("id", conversationId);
      } catch (e) {
        console.warn("cancel conversation error", e);
      }
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SEEN_COUNT_KEY);
    setConversationId(null);
    setMessages([]);
    setSeenAdminCount(0);
    setInput("");
    setName("");
    setEmail("");
    setConfirmCancel(false);
    setOpen(false);
  }

  // X button click: just close panel if no convo, else ask if they want to cancel
  function onXClick() {
    if (!conversationId || messages.length === 0) {
      setOpen(false);
      return;
    }
    setConfirmCancel(true);
  }

  const suggestions = [
    "I want to ship from France to the US – how does it work?",
    "What are your rates for Europe-bound shipments?",
    "Can you help with customs and last-mile delivery?",
  ];

  return (
    <>
      {/* Floating bubble — extra visible: ring + glow + slow pulse */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        className="
          fixed
          right-5 bottom-8
          md:right-8 md:bottom-10
          z-40
          flex h-16 w-16 items-center justify-center
          rounded-full
          bg-gradient-to-br from-blue-500 to-blue-700
          text-white
          shadow-[0_10px_30px_-5px_rgba(37,99,235,0.6)]
          hover:scale-105 active:scale-95
          ring-4 ring-blue-200/70
          transition-transform duration-200
          ge-chat-bubble
        "
      >
        {open ? <X size={26} /> : <MessageCircle size={28} />}
        {!open && unreadAdmin > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold grid place-items-center ring-2 ring-white animate-pulse">
            {unreadAdmin > 9 ? "9+" : unreadAdmin}
          </span>
        )}
        {!open && unreadAdmin === 0 && (
          // small label so the bubble is "visible" — fades after a hint period
          <span className="hidden sm:flex absolute right-[5.2rem] whitespace-nowrap px-3 py-1.5 rounded-full bg-white text-blue-700 text-xs font-bold shadow-md border border-blue-100">
            Live chat
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="
            fixed
            right-5 bottom-28
            md:right-8 md:bottom-32
            z-40
            w-[24rem] max-w-[94vw]
            max-h-[85vh]
            rounded-2xl shadow-2xl
            bg-white border border-blue-100
            flex flex-col overflow-hidden
            ring-1 ring-blue-100
          "
        >
          {/* Header — bolder gradient */}
          <div
            className="px-4 py-3 flex items-center justify-between text-white"
            style={{ background: "linear-gradient(135deg,#2563eb 0%,#3b82f6 60%,#60a5fa 100%)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 grid place-items-center ring-2 ring-white/30">
                <Headphones size={18} />
              </div>
              <div>
                <div className="text-[14px] font-bold leading-tight flex items-center gap-1.5">
                  Envoy Live Support
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-300 ring-2 ring-emerald-300/40 animate-pulse" />
                </div>
                <div className="text-[11px] text-blue-50 leading-tight">
                  Real humans • Replies under 30 min
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onXClick}
              className="p-1.5 rounded-md hover:bg-white/15 transition"
              aria-label={conversationId ? "Cancel conversation" : "Close"}
              title={conversationId ? "Cancel this conversation" : "Close"}
            >
              <X size={18} />
            </button>
          </div>

          {/* Cancel-confirmation banner (replaces other content if active) */}
          {confirmCancel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 bg-rose-50/50">
              <div className="w-12 h-12 rounded-full bg-rose-100 grid place-items-center text-rose-600 mb-3">
                <X size={24} />
              </div>
              <h4 className="font-semibold text-slate-900">Cancel this chat?</h4>
              <p className="mt-1 text-xs text-slate-600 max-w-xs">
                Cancelling closes the conversation with our team. Your messages stay with us
                in case we need to follow up via email.
              </p>
              <div className="mt-5 flex gap-2 w-full max-w-xs">
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Keep chatting
                </button>
                <button
                  onClick={cancelConversation}
                  className="flex-1 px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
                >
                  Yes, cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Intro */}
              <div className="px-4 py-3 border-b border-blue-50 bg-blue-50/60 text-[11px] leading-relaxed space-y-1">
                <p className="text-slate-700">
                  Tell us your{" "}
                  <span className="font-semibold text-blue-700">
                    origin, destination, shipment type and timing
                  </span>{" "}
                  and we'll guide you on the best options.
                </p>
                <p className="text-slate-600">
                  Or email us anytime:{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-semibold text-blue-700 hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              </div>

              {/* Name / email (only before a conversation exists) */}
              {!conversationId && (
                <div className="px-4 py-3 border-b border-blue-50 space-y-2 text-[11px] bg-white">
                  <p className="text-slate-700">
                    Add your details so a coordinator can follow up:
                  </p>
                  <input
                    className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="Full name / company"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="Email (for quotes & tracking)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 px-3 py-3 overflow-y-auto space-y-2 text-xs bg-slate-50/60 min-h-[180px]">
                {messages.length === 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-slate-600 text-[11px]">
                      You can start with one of these:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setInput(s)}
                          className="text-left rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] text-slate-700 hover:bg-blue-50 hover:border-blue-300 transition"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug shadow-sm ${
                        m.sender === "visitor"
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm"
                          : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      <div
                        className={`mt-0.5 text-[10px] ${
                          m.sender === "visitor" ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Error banner */}
              {error && (
                <div className="px-3 py-2 text-[11px] text-rose-700 bg-rose-50 border-t border-rose-200">
                  {error}
                </div>
              )}

              {/* Input */}
              <form
                className="border-t border-slate-200 flex items-center px-2 py-2 gap-2 bg-white"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <input
                  className="flex-1 text-[12.5px] px-3 py-2 rounded-full border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50 disabled:text-slate-400"
                  placeholder={
                    loading
                      ? "Starting conversation…"
                      : sending
                      ? "Sending…"
                      : "Type your message…"
                  }
                  value={input}
                  disabled={loading || sending}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={loading || sending || !input.trim()}
                  aria-label="Send message"
                  className="
                    p-2.5 rounded-full
                    bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95
                    text-white transition
                    disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                    shadow-sm
                  "
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Local CSS — pulse glow on the bubble */}
      <style>{`
        @keyframes ge-chat-pulse {
          0%, 100% { box-shadow: 0 10px 30px -5px rgba(37,99,235,0.6), 0 0 0 0 rgba(59,130,246,0.5); }
          50%      { box-shadow: 0 10px 30px -5px rgba(37,99,235,0.6), 0 0 0 14px rgba(59,130,246,0); }
        }
        .ge-chat-bubble { animation: ge-chat-pulse 2.6s ease-out infinite; }
      `}</style>
    </>
  );
}
