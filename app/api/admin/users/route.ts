import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { listAllUsers } from "@/lib/users";
import { dbQuery, ensureDatabase } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page")) || 1));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 20)));
  const search = url.searchParams.get("search")?.trim() || undefined;

  const result = await listAllUsers({ search, page, limit });
  const users = result.users.map((u) => ({
    ...u,
    isSuperAdmin: isAdminEmail(u.email)
  }));

  await ensureDatabase();
  const [profileCount] = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM influencers WHERE status = 'active'`
  );
  const [submissionCount] = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM submissions WHERE status = 'pending'`
  );
  const [adminCount] = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM users WHERE role = 'admin'`
  );

  return NextResponse.json({
    users,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    stats: {
      totalUsers: result.total,
      totalAdmins: Number(adminCount?.count ?? "0"),
      totalProfiles: Number(profileCount?.count ?? "0"),
      pendingSubmissions: Number(submissionCount?.count ?? "0")
    }
  });
}
