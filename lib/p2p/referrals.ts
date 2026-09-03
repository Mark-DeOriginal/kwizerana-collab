import { randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";

export type ReferralInfo = {
  code: string;
  referredCount: number;
  link: string;
};

function generateCode(): string {
  return randomBytes(4).toString("base64url").toUpperCase().slice(0, 8);
}

export async function getReferralCode(userId: string): Promise<string> {
  await ensureDatabase();
  const rows = await dbQuery<{ referral_code: string | null }>(
    `SELECT referral_code FROM users WHERE id = $1`,
    [userId]
  );
  if (rows[0]?.referral_code) return rows[0].referral_code;

  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await dbQuery<{ id: string }>(
      `SELECT id FROM users WHERE referral_code = $1`,
      [code]
    );
    if (clash.length === 0) break;
    code = generateCode();
  }
  await dbQuery(`UPDATE users SET referral_code = $2 WHERE id = $1`, [userId, code]);
  return code;
}

export async function countReferrals(userId: string): Promise<number> {
  await ensureDatabase();
  const rows = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM users WHERE referred_by = $1`,
    [userId]
  );
  return Number(rows[0]?.count ?? "0");
}

/** Attributes a new user to a referrer (once). Silently ignores invalid/self codes. */
export async function applyReferralCode(userId: string, code: string | undefined | null): Promise<void> {
  if (!code) return;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;
  await ensureDatabase();
  const referrer = await dbQuery<{ id: string }>(
    `SELECT id FROM users WHERE referral_code = $1`,
    [normalized]
  );
  const ref = referrer[0];
  if (!ref || ref.id === userId) return;
  await dbQuery(
    `UPDATE users SET referred_by = $2 WHERE id = $1 AND referred_by IS NULL`,
    [userId, ref.id]
  );
}
