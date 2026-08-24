import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getAntiPhishingCode, setAntiPhishingCode, validateAntiPhishingCode } from "@/lib/p2p/anti-phishing";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const code = await getAntiPhishingCode(userId);
  return NextResponse.json({ code });
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

  const code = String(body.code ?? "");
  const error = validateAntiPhishingCode(code);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  await setAntiPhishingCode(userId, code);

  return NextResponse.json({ ok: true, code });
}
