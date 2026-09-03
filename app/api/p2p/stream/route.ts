import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream. Proxies the lightweight /api/p2p/updates digest
 * into a long-lived connection so connected clients get near-real-time
 * notifications without each one polling. Clients fall back to polling if SSE
 * is unavailable (e.g. serverless runtime limits).
 */
export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const heartbeat = setInterval(() => enqueue(": heartbeat\n\n"), 15000);

      let lastChangedAt: string | null = null;
      const tick = async () => {
        if (closed) return;
        try {
          const res = await fetch(`${baseUrl}/api/p2p/updates`, { cache: "no-store" });
          const data = (await res.json()) as { changedAt?: string };
          if (res.ok && data?.changedAt && data.changedAt !== lastChangedAt) {
            lastChangedAt = data.changedAt;
            enqueue(`event: update\ndata: ${JSON.stringify(data)}\n\n`);
          }
        } catch {
          // transient — ignore
        }
      };

      await tick();
      const poll = setInterval(() => void tick(), 5000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        clearInterval(poll);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
