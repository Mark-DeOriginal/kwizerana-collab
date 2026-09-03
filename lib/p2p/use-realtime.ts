"use client";

import { useEffect, useRef } from "react";
import { readJson } from "@/lib/client-request";
import type { Trade } from "@/lib/p2p/trades";

export const TERMINAL_TRADE_STATUSES = ["completed", "cancelled", "expired", "disputed"];

export function isTerminalTrade(status: string): boolean {
  return TERMINAL_TRADE_STATUSES.includes(status);
}

/**
 * Runs `fn` on an interval while `enabled`.
 * Skipped while the tab is hidden, never overlaps an in-flight run, stops on unmount,
 * and never surfaces errors to the UI.
 */
export function usePoll(fn: () => void | Promise<void>, opts: { intervalMs: number; enabled?: boolean }): void {
  const { intervalMs, enabled = true } = opts;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        try {
          await fnRef.current();
        } catch {
          // Silent — polling must never surface errors to the UI.
        }
      }
      if (cancelled) return;
      timer = setTimeout(() => void loop(), intervalMs);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}

function tradeStamp(t: Trade): string {
  return [
    t.status,
    t.escrow_status ?? "",
    t.receipt_image ?? "",
    t.buyer_paid_at ?? "",
    t.released_at ?? "",
    t.claimed_at ?? ""
  ].join("|");
}

/**
 * Polls a single trade and calls `onTrade` only when its visible state actually changes,
 * so listeners only re-render when something new arrives.
 */
export function useTradeSubscription(
  tradeId: string | undefined,
  onTrade: (trade: Trade) => void,
  opts: { intervalMs?: number; enabled?: boolean } = {}
): void {
  const onTradeRef = useRef(onTrade);
  onTradeRef.current = onTrade;
  const lastStampRef = useRef<string>("");

  usePoll(
    async () => {
      if (!tradeId) return;
      const res = await fetch(`/api/p2p/trades/${tradeId}`, { cache: "no-store" });
      const data = await readJson<{ trade?: Trade }>(res);
      const trade = data?.trade;
      if (!res.ok || !trade) return;
      const stamp = tradeStamp(trade);
      if (stamp !== lastStampRef.current) {
        lastStampRef.current = stamp;
        onTradeRef.current(trade);
      }
    },
    { intervalMs: opts.intervalMs ?? 8000, enabled: Boolean(tradeId) && (opts.enabled ?? true) }
  );
}

/**
 * Subscribes to the server-sent events feed for general app updates (trades,
 * notifications, disputes). Calls `onUpdate` whenever anything changes. Safe to
 * use everywhere — it degrades silently if SSE is unsupported.
 */
export function useRealtimeFeed(onUpdate: () => void): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/p2p/stream");
      es.addEventListener("update", () => onUpdateRef.current());
      es.onerror = () => {
        // Let polling take over; close the connection on persistent failure.
        es?.close();
      };
    } catch {
      // EventSource unavailable — rely on polling.
    }
    return () => {
      try {
        es?.close();
      } catch {
        // ignore
      }
    };
  }, []);
}