"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";
import { readJson } from "@/lib/client-request";
import type { P2PNotification } from "@/lib/p2p/notifications";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const PAGE = 30;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<P2PNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (reset: boolean) => {
    const next = reset ? 0 : offset;
    setLoading(true);
    const res = await fetch(`/api/p2p/notifications?limit=${PAGE}&offset=${next}`, { cache: "no-store" });
    const data = await readJson<{ notifications: P2PNotification[]; unread: number }>(res);
    if (res.ok && data) {
      setNotifications((prev) => (reset ? data.notifications : [...prev, ...data.notifications]));
      setUnread(data.unread);
      setHasMore(data.notifications.length === PAGE);
      setOffset(next + data.notifications.length);
    }
    setLoading(false);
  }, [offset]);

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markRead(id?: string) {
    setBusyId(id ?? "all");
    const res = await fetch("/api/p2p/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {})
    });
    setBusyId(null);
    if (res.ok) {
      const data = await readJson<{ unread: number }>(res);
      if (data) setUnread(data.unread);
      setNotifications((prev) => prev.map((n) => (id ? (n.id === id ? { ...n, is_read: true } : n) : { ...n, is_read: true })));
    }
  }

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Notifications</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-muted">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => void markRead()}
              disabled={busyId === "all"}
              className="flex h-9 items-center gap-1.5 border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-ocean disabled:opacity-60"
            >
              {busyId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center gap-3 border border-line bg-white p-6 text-sm text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-ocean" />
              Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-panel/60 px-4 py-12 text-center">
              <Bell className="h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-semibold">No notifications yet</p>
              <p className="mt-1 text-sm text-muted">Trade updates and notices will show up here.</p>
              <Link href="/p2p-marketplace/trade" className="mt-4 text-sm font-semibold text-ocean hover:underline">Start trading</Link>
            </div>
          ) : (
            <>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.is_read) void markRead(n.id); }}
                  disabled={busyId === n.id}
                  className={`flex w-full items-start gap-3 border px-4 py-3 text-left transition-colors ${n.is_read ? "border-line bg-white" : "border-ocean/30 bg-mint/20"}`}
                >
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ocean" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
                </button>
              ))}
              {hasMore && (
                <button
                  onClick={() => void load(false)}
                  disabled={loading}
                  className="flex h-10 w-full items-center justify-center gap-2 border border-line bg-white text-sm font-semibold text-ocean transition-colors hover:border-ocean disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
