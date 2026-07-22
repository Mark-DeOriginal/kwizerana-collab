import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { ALL_PERMISSIONS, hasPermission, isAdminEmail, isSuperAdmin, type Permission } from "@/lib/roles";
import { updateUserRole } from "@/lib/users";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;

  const isAllowed = allowDevAdmin || isAdminEmail(session?.user?.email) ||
    (session?.user?.role === "admin" && hasPermission(session?.user?.role, session?.user?.permissions ?? [], "manage_admins"));

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "promote") {
    const selectedPermissions: Permission[] = Array.isArray(body.permissions)
      ? body.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p as Permission))
      : [];

    const updated = await updateUserRole(params.id, "admin", selectedPermissions);
    if (!updated) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  }

  if (body.action === "demote") {
    const rows = await dbQuery<{ email: string }>(
      `SELECT email FROM users WHERE id = $1`,
      [params.id]
    );
    const targetEmail = rows[0]?.email;

    if (!targetEmail) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (isSuperAdmin(targetEmail)) {
      return NextResponse.json({ error: "Cannot demote a super admin." }, { status: 403 });
    }

    const updated = await updateUserRole(params.id, "member", []);
    return NextResponse.json({ user: updated });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
