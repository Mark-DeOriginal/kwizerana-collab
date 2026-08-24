import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { getUserCredentialsByEmail } from "@/lib/users";
import { issueLoginTicket, issueTwoFactorChallenge } from "@/lib/auth/tickets";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`login:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await getUserCredentialsByEmail(email);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.password_hash) {
    return NextResponse.json(
      { error: "This account uses Google sign-in. Continue with Google instead." },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!user.email_verified) {
    return NextResponse.json(
      { error: "Please verify your email address before signing in.", code: "email_unverified" },
      { status: 403 }
    );
  }

  if (user.totp_enabled) {
    const challenge = issueTwoFactorChallenge(user.id);
    return NextResponse.json({ step: "2fa", challenge });
  }

  const ticket = await issueLoginTicket(user.id);
  return NextResponse.json({ step: "done", ticket });
}
