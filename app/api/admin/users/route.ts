import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { hasPermission, isAdminEmail } from "@/lib/roles";
import { listAllUsers } from "@/lib/users";
import { dbQuery, ensureDatabase } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    hasPermission(session?.user?.role ?? "member", session?.user?.permissions ?? [], "view_dashboard");

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const users = (await listAllUsers()).map((u) => ({
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

  return NextResponse.json({
    users,
    stats: {
      totalProfiles: Number(profileCount?.count ?? "0"),
      pendingSubmissions: Number(submissionCount?.count ?? "0")
    }
  });
}
