import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { createBoard, listBoards, RANK_DEPTH, TOP_LEVEL_NICHES } from "@/lib/rankings";

export async function GET() {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  if (!allowDevAdmin && !isAdminEmail(session?.user?.email) &&
    !hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const boards = await listBoards();
  return NextResponse.json({ boards, topLevelNiches: TOP_LEVEL_NICHES, rankDepth: RANK_DEPTH });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  if (!allowDevAdmin && !isAdminEmail(session?.user?.email) &&
    !hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const niche = String(body.niche ?? "").trim();
  const subNiche = String(body.sub_niche ?? "").trim();

  if (!niche) {
    return NextResponse.json({ error: "Niche is required." }, { status: 400 });
  }

  const board = await createBoard(niche, subNiche);
  return NextResponse.json({ board }, { status: 201 });
}
