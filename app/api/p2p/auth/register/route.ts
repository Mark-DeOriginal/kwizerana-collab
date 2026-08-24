import { NextResponse } from "next/server";
import { hashPassword, validateEmail, validatePassword } from "@/lib/auth/password";
import { createPasswordUser, getUserCredentialsByEmail, setUserPassword } from "@/lib/users";
import { createVerificationToken } from "@/lib/p2p/verification";
import { sendEmail, renderAntiPhishingNotice } from "@/lib/p2p/email";
import { getSiteUrl } from "@/lib/site";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const name = body.name ? String(body.name).trim() : "";

  const emailError = validateEmail(email);
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 });

  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const normalized = email.toLowerCase();
  const existing = await getUserCredentialsByEmail(normalized);

  if (existing?.password_hash || existing?.email_verified) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  if (existing) {
    await setUserPassword(existing.id, passwordHash);
    userId = existing.id;
  } else {
    const created = await createPasswordUser({
      email: normalized,
      name: name || null,
      passwordHash
    });
    userId = created.id;
  }

  const token = await createVerificationToken(userId, "email_verify", 24);
  const verifyUrl = `${getSiteUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: normalized,
    subject: "Verify your email address",
    text: `Welcome to Kwizerana Collab. Verify your email to activate your account: ${verifyUrl}`,
    html: `
      <div style="font-family:Inter,ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#182026;">
        <h1 style="font-size:20px;margin:0 0 16px;">Verify your email address</h1>
        <p style="margin:0 0 16px;line-height:1.6;">
          Thanks for creating a Kwizerana Collab account. Confirm your email address to activate your account.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#182026;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:600;">
          Verify email
        </a>
        <p style="margin:16px 0 0;color:#68737d;font-size:13px;">
          If the button doesn&apos;t work, copy and paste this link into your browser:<br/>
          <span style="word-break:break-all;">${verifyUrl}</span>
        </p>
        <p style="margin:16px 0 0;color:#68737d;font-size:13px;">This link expires in 24 hours.</p>
        ${renderAntiPhishingNotice(null)}
      </div>`
  });

  return NextResponse.json({ ok: true, emailVerificationRequired: true });
}
