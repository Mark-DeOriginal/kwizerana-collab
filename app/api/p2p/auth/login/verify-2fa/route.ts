import { NextResponse } from "next/server";
import { verifyTwoFactorChallenge, issueLoginTicket } from "@/lib/auth/tickets";
import { getUserCredentialsById } from "@/lib/users";
import { consumeBackupCode, getStoredSecret, verifyTotpCode } from "@/lib/p2p/two-factor";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`login-2fa:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const challenge = String(body.challenge ?? "");
  const code = String(body.code ?? "").replace(/\s+/g, "");
  const isBackupCode = code.includes("-");

  const userId = verifyTwoFactorChallenge(challenge);
  if (!userId) {
    return NextResponse.json({ error: "Two-factor challenge expired. Please sign in again." }, { status: 401 });
  }

  const user = await getUserCredentialsById(userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 401 });
  }

  if (!user.totp_enabled) {
    return NextResponse.json({ error: "Two-factor authentication is not enabled." }, { status: 400 });
  }

  let ok = false;

  if (isBackupCode) {
    ok = await consumeBackupCode(userId, code);
  } else {
    const secret = await getStoredSecret(userId);
    ok = secret ? verifyTotpCode(secret, code) : false;
  }

  if (!ok) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 401 });
  }

  const ticket = await issueLoginTicket(userId);
  return NextResponse.json({ step: "done", ticket });
}
