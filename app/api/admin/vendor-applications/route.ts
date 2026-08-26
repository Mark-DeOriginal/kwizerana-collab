import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { dbQuery, ensureDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "pending";

  await ensureDatabase();
  const rows = await dbQuery<{
    id: string;
    user_id: string;
    user_email: string;
    user_name: string | null;
    user_image: string | null;
    application_type: string;
    requested_level: string;
    status: string;
    details: string;
    reviewed_at: string | null;
    created_at: string;
  }>(
    `SELECT a.id::TEXT AS id, a.user_id::TEXT AS user_id, u.email AS user_email, u.name AS user_name, u.image AS user_image,
            a.application_type, a.requested_level, a.status, a.details::TEXT AS details, a.reviewed_at, a.created_at
     FROM p2p_advertiser_applications a
     JOIN users u ON u.id = a.user_id
     WHERE a.status = $1
     ORDER BY a.created_at DESC`,
    [statusFilter]
  );

  const applications = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    userImage: r.user_image,
    applicationType: r.application_type,
    requestedLevel: r.requested_level,
    status: r.status,
    details: (() => { try { return JSON.parse(r.details); } catch { return {}; } })(),
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at
  }));

  return NextResponse.json({ applications });
}
