import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { dbQuery, ensureDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  await ensureDatabase();
  const rows = await dbQuery<{
    id: string;
    application_type: string;
    requested_level: string;
    status: string;
    details: string;
    reviewed_at: string | null;
    created_at: string;
  }>(
    `SELECT id::TEXT AS id, application_type, requested_level, status, details::TEXT AS details, reviewed_at, created_at
     FROM p2p_advertiser_applications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );

  const applications = rows.map((r) => ({
    id: r.id,
    applicationType: r.application_type,
    requestedLevel: r.requested_level,
    status: r.status,
    details: (() => { try { return JSON.parse(r.details); } catch { return {}; } })(),
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at
  }));

  return NextResponse.json({ applications });
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

  const applicationType = String(body.applicationType ?? "general");
  const requestedLevel = String(body.requestedLevel ?? "beginner");
  const details = body.details ?? {};

  if (!Array.isArray(body.cryptoCurrencies) || body.cryptoCurrencies.length === 0) {
    return NextResponse.json({ error: "Select at least one cryptocurrency." }, { status: 400 });
  }
  if (!Array.isArray(body.fiatCurrencies) || body.fiatCurrencies.length === 0) {
    return NextResponse.json({ error: "Select at least one fiat currency." }, { status: 400 });
  }

  await ensureDatabase();

  // Check if user already has a pending application
  const existing = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM p2p_advertiser_applications WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: "You already have a pending application." }, { status: 400 });
  }

  // Check if user is already a vendor
  const user = await dbQuery<{ p2p_advertiser_status: string }>(
    `SELECT p2p_advertiser_status FROM users WHERE id = $1`,
    [userId]
  );
  if (user[0] && user[0].p2p_advertiser_status !== "none") {
    return NextResponse.json({ error: "You are already a vendor." }, { status: 400 });
  }

  const detailsJson = {
    cryptoCurrencies: body.cryptoCurrencies,
    fiatCurrencies: body.fiatCurrencies,
    paymentMethodIds: body.paymentMethodIds ?? [],
    bio: body.bio ?? ""
  };

  const inserted = await dbQuery<{ id: string }>(
    `INSERT INTO p2p_advertiser_applications (user_id, application_type, requested_level, status, details)
     VALUES ($1, $2, $3, 'pending', $4::jsonb)
     RETURNING id::TEXT AS id`,
    [userId, applicationType, requestedLevel, JSON.stringify(detailsJson)]
  );

  return NextResponse.json({ applicationId: inserted[0]?.id, ok: true });
}
