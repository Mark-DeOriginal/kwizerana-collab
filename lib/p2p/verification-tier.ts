import { dbQuery, ensureDatabase } from "@/lib/db";
import { createNotification, notifyByEmail } from "@/lib/p2p/notifications";

export type VerificationRequest = {
  id: string;
  user_id: string;
  note: string;
  status: string;
  created_at: string;
};

export async function getVerificationStatus(userId: string): Promise<VerificationRequest | null> {
  await ensureDatabase();
  const rows = await dbQuery<VerificationRequest>(
    `SELECT id::TEXT AS id, user_id, note, status, created_at
     FROM p2p_verification_requests WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function requestVerification(userId: string, note: string): Promise<VerificationRequest> {
  await ensureDatabase();

  const vendor = await dbQuery<{ status: string }>(
    `SELECT p2p_advertiser_status AS status FROM users WHERE id = $1`,
    [userId]
  );
  if (!vendor[0] || vendor[0].status === "none") {
    throw new Error("Only vendors can request verification.");
  }
  if (vendor[0].status === "verified") {
    throw new Error("You are already verified.");
  }

  const pending = await dbQuery<{ id: string }>(
    `SELECT id FROM p2p_verification_requests WHERE user_id = $1 AND status = 'pending' LIMIT 1`,
    [userId]
  );
  if (pending.length > 0) throw new Error("You already have a pending verification request.");

  const inserted = await dbQuery<VerificationRequest>(
    `INSERT INTO p2p_verification_requests (user_id, note)
     VALUES ($1, $2)
     RETURNING id::TEXT AS id, user_id, note, status, created_at`,
    [userId, note.trim()]
  );
  return inserted[0];
}

export type AdminVerification = VerificationRequest & { name: string; email: string };

export async function listVerificationRequests(): Promise<AdminVerification[]> {
  await ensureDatabase();
  return dbQuery<AdminVerification>(
    `SELECT v.id::TEXT AS id, v.user_id, v.note, v.status, v.created_at, u.name, u.email
     FROM p2p_verification_requests v
     JOIN users u ON u.id = v.user_id
     ORDER BY (v.status = 'pending') DESC, v.created_at DESC`
  );
}

export async function reviewVerification(adminUserId: string, id: string, approve: boolean): Promise<void> {
  await ensureDatabase();
  const rows = await dbQuery<{ user_id: string; status: string }>(
    `SELECT user_id, status FROM p2p_verification_requests WHERE id = $1`,
    [id]
  );
  const r = rows[0];
  if (!r) throw new Error("Request not found.");
  if (r.status !== "pending") throw new Error("Request already reviewed.");

  await dbQuery(
    `UPDATE p2p_verification_requests SET status = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $1`,
    [id, approve ? "approved" : "rejected", adminUserId]
  );

  if (approve) {
    await dbQuery(
      `UPDATE users SET p2p_advertiser_status = 'verified', p2p_verified_tier = 'gold', updated_at = NOW() WHERE id = $1`,
      [r.user_id]
    );
  }

  await createNotification(r.user_id, {
    type: approve ? "vendor_verified" : "vendor_verification_rejected",
    title: approve ? "You're now verified" : "Verification update",
    body: approve
      ? "Your account is now verified. A verified badge appears on your listings."
      : "Your verification request was not approved at this time."
  });
  await notifyByEmail(
    r.user_id,
    approve ? "You're now a verified vendor" : "Verification update",
    approve
      ? "Good news — your account is now verified. A verified badge now appears on your listings."
      : "Your verification request was not approved at this time. You may reapply later."
  );
}
