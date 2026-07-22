import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { dbQuery, ensureDatabase } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await ensureDatabase();
  await dbQuery(
    `UPDATE users SET last_sign_in_at = NOW(), updated_at = NOW() WHERE email = $1`,
    [session.user.email.toLowerCase()]
  );

  return NextResponse.json({ ok: true });
}
