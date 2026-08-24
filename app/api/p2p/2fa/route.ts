import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getUserCredentialsById } from "@/lib/users";
import { verifyPassword } from "@/lib/auth/password";
import {
  confirmTwoFactor,
  consumeBackupCode,
  disableTwoFactor,
  generateBackupCodes,
  generateOtpauthUrl,
  generateTotpSecret,
  getStoredSecret,
  getTwoFactorStatus,
  hashBackupCode,
  storePendingSecret,
  verifyTotpCode
} from "@/lib/p2p/two-factor";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const status = await getTwoFactorStatus(userId);
  return NextResponse.json(status);
}

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const status = await getTwoFactorStatus(userId);
  if (status.enabled) {
    return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 409 });
  }

  const user = await getUserCredentialsById(userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const secret = generateTotpSecret();
  await storePendingSecret(userId, secret);

  const otpauthUrl = generateOtpauthUrl(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return NextResponse.json({ secret, otpauthUrl, qrDataUrl });
}

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

  const code = String(body.code ?? "").trim();

  const status = await getTwoFactorStatus(userId);
  if (status.enabled) {
    return NextResponse.json({ error: "Two-factor authentication is already enabled." }, { status: 409 });
  }

  const secret = await getStoredSecret(userId);
  if (!secret) {
    return NextResponse.json({ error: "Start two-factor setup first." }, { status: 400 });
  }

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  const backupCodes = generateBackupCodes(10);
  await confirmTwoFactor(userId, backupCodes.map(hashBackupCode));

  return NextResponse.json({ ok: true, backupCodes });
}

export async function DELETE(request: Request) {
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

  const password = String(body.password ?? "");
  const code = String(body.code ?? "").replace(/\s+/g, "");

  const user = await getUserCredentialsById(userId);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  let authorized = false;

  if (user.password_hash && password) {
    authorized = await verifyPassword(password, user.password_hash);
  } else if (code) {
    if (code.includes("-")) {
      authorized = await consumeBackupCode(userId, code);
    } else {
      const secret = await getStoredSecret(userId);
      authorized = secret ? verifyTotpCode(secret, code) : false;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Invalid password or code." }, { status: 401 });
  }

  await disableTwoFactor(userId);

  return NextResponse.json({ ok: true });
}
