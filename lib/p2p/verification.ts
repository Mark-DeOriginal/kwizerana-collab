import { createHash, randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createVerificationToken(
  userId: string,
  tokenType: string,
  ttlHours = 24
): Promise<string> {
  await ensureDatabase();
  const token = randomBytes(32).toString("base64url");
  await dbQuery(
    `INSERT INTO p2p_verification_tokens (user_id, token_hash, token_type, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(hours => $4))`,
    [userId, hashToken(token), tokenType, ttlHours]
  );
  return token;
}

export async function consumeVerificationToken(
  token: string,
  tokenType: string
): Promise<string | null> {
  await ensureDatabase();
  const rows = await dbQuery<{ user_id: string }>(
    `UPDATE p2p_verification_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [hashToken(token), tokenType]
  );
  return rows[0]?.user_id ?? null;
}
