import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { deleteBoard, getBoard, saveBoardEntries } from "@/lib/rankings";

function canEdit(session: Session | null) {
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  return allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!canEdit(session)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const board = await getBoard((await params).id);
  if (!board) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  return NextResponse.json({ board });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!canEdit(session)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const entries = Array.isArray(body.entries) ? body.entries : [];

  const normalized = entries
    .filter(
      (e: { position?: unknown; influencerId?: unknown }) =>
        typeof e?.position === "number" && typeof e?.influencerId === "number"
    )
    .map((e: { position: number; influencerId: number }) => ({
      position: Math.max(1, Math.floor(e.position)),
      influencerId: Math.floor(e.influencerId)
    }));

  await saveBoardEntries((await params).id, normalized);
  const board = await getBoard((await params).id);

  return NextResponse.json({ board });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!canEdit(session)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await deleteBoard((await params).id);
  return NextResponse.json({ ok: true });
}
