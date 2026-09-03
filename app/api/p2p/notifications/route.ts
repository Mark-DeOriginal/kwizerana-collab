import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { listNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount } from "@/lib/p2p/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const [notifications, unread] = await Promise.all([
    listNotifications(userId, limit, offset),
    getUnreadNotificationCount(userId)
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = body.id ? String(body.id) : null;
  if (id) {
    await markNotificationRead(userId, id);
  } else {
    await markAllNotificationsRead(userId);
  }
  return NextResponse.json({ ok: true, unread: await getUnreadNotificationCount(userId) });
}
