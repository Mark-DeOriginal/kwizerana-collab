import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/p2p/verification";
import { markEmailVerified } from "@/lib/users";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = String(body.token ?? "");

  if (!token) {
    return NextResponse.json({ error: "Verification token is required." }, { status: 400 });
  }

  const userId = await consumeVerificationToken(token, "email_verify");
  if (!userId) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  await markEmailVerified(userId);

  return NextResponse.json({ ok: true });
}
