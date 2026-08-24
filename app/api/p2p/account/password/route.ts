import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getUserCredentialsById, setUserPassword } from "@/lib/users";
import { hashPassword, verifyPassword, validatePassword } from "@/lib/auth/password";

export async function PUT(request: Request) {
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

  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const user = await getUserCredentialsById(userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  if (user.password_hash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.password_hash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  }

  const newHash = await hashPassword(newPassword);
  await setUserPassword(userId, newHash);

  return NextResponse.json({ ok: true });
}
