import { NextResponse } from "next/server";
import { validateEmail } from "@/lib/auth/password";
import { getUserCredentialsByEmail } from "@/lib/users";
import { createVerificationToken } from "@/lib/p2p/verification";
import { sendEmail, renderAntiPhishingNotice } from "@/lib/p2p/email";
import { getSiteUrl } from "@/lib/site";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`resend-verification:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const emailError = validateEmail(email);
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 });

  const user = await getUserCredentialsByEmail(email.toLowerCase());

  if (user && !user.email_verified) {
    const token = await createVerificationToken(user.id, "email_verify", 24);
    const verifyUrl = `${getSiteUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your email address",
      text: `Verify your email to activate your account: ${verifyUrl}`,
      html: `
        <div style="font-family:Inter,ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#182026;">
          <h1 style="font-size:20px;margin:0 0 16px;">Verify your email address</h1>
          <p style="margin:0 0 16px;line-height:1.6;">Confirm your email address to activate your Kwizerana Collab account.</p>
          <a href="${verifyUrl}" style="display:inline-block;background:#182026;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:600;">Verify email</a>
          <p style="margin:16px 0 0;color:#68737d;font-size:13px;">This link expires in 24 hours.</p>
          ${renderAntiPhishingNotice(user.anti_phishing_code)}
        </div>`
    });
  }

  return NextResponse.json({ ok: true });
}
