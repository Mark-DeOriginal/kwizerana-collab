import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { searchInfluencers } from "@/lib/rankings";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  const allowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!allowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const results = await searchInfluencers(q);
  return NextResponse.json({ results });
}
