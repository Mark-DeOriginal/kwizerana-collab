import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { getVerificationStatus, requestVerification } from "@/lib/p2p/verification-tier";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const request = await getVerificationStatus(userId);
  return NextResponse.json({ request });
}

export async function POST(request: Request) {
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

  const note = String(body.note ?? "").trim();
  if (!note) {
    return NextResponse.json({ error: "Tell us why you should be verified." }, { status: 400 });
  }

  try {
    const requestRecord = await requestVerification(userId, note);
    return NextResponse.json({ request: requestRecord }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to request verification." }, { status: 400 });
  }
}
