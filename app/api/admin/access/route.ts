import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";

/**
 * A deliberately small, uncached authorization check for the admin shell.
 * The client must receive this confirmation before it mounts any dashboard
 * workspace, so a revoked permission cannot briefly expose that workspace.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!allowed) {
    return NextResponse.json({ allowed: false }, {
      status: 403,
      headers: { "Cache-Control": "no-store" }
    });
  }

  return NextResponse.json({ allowed: true }, {
    headers: { "Cache-Control": "no-store" }
  });
}
