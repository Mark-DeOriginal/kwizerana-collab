"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { readJson } from "@/lib/client-request";
import type { ChatMessage } from "@/lib/p2p/chat";

function chatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function TradeChat({ tradeId, myRole }: { tradeId: string; myRole: "buyer" | "seller" }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/p2p/trades/${tradeId}/messages`, { cache: "no-store" });
    const data = await readJson<{ messages?: ChatMessage[] }>(res);
    if (res.ok && data?.messages) setMessages(data.messages);
    setLoading(false);
  }, [tradeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    const res = await fetch(`/api/p2p/trades/${tradeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t })
    });
    setSending(false);
    if (res.ok) {
      setText("");
      await load();
    }
  }

  return (
    <div className="border border-line bg-surface">
      <p className="border-b border-line px-4 py-3 text-sm font-semibold">Chat</p>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-ocean" />
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet. Start the conversation with your counterparty.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === myRole;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] border px-3 py-2 text-sm ${mine ? "border-ocean/30 bg-mint/30" : "border-line bg-panel"}`}>
                  <p className="text-xs font-semibold text-muted">{mine ? "You" : m.sender_name}</p>
                  <p className="mt-0.5 break-words">{m.message_text}</p>
                  <p className="mt-1 text-right text-[10px] text-muted">{chatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-line p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Type a message…"
          className="h-9 flex-1 border border-line bg-surface px-3 text-sm outline-none focus:border-ocean"
        />
        <button
          onClick={() => void send()}
          disabled={sending || !text.trim()}
          className="flex h-9 items-center gap-1.5 bg-ink px-3 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
