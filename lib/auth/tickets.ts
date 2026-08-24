import { createHash, randomBytes } from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { signPayload, verifyPayload } from "@/lib/auth/signing";

const TICKET_TTL_SECONDS = 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;

type LoginTicketPayload = { sub: string; nonce: string; purpose: "login" };
type ChallengePayload = { sub: string; purpose: "2fa" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueLoginTicket(userId: string): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const ticket = signPayload({ sub: userId, nonce, purpose: "login" }, TICKET_TTL_SECONDS);

  await ensureDatabase();
  await dbQuery(
    `INSERT INTO p2p_auth_tickets (user_id, ticket_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '60 seconds')`,
    [userId, hashToken(ticket)]
  );

  return ticket;
}

export async function consumeLoginTicket(ticket: string): Promise<string | null> {
  const payload = verifyPayload<LoginTicketPayload>(ticket);
  if (!payload || payload.purpose !== "login" || !payload.sub) return null;

  await ensureDatabase();
  const rows = await dbQuery<{ user_id: string }>(
    `UPDATE p2p_auth_tickets
     SET used_at = NOW()
     WHERE ticket_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [hashToken(ticket)]
  );

  return rows[0]?.user_id ?? null;
}

export function issueTwoFactorChallenge(userId: string): string {
  return signPayload({ sub: userId, purpose: "2fa" }, CHALLENGE_TTL_SECONDS);
}

export function verifyTwoFactorChallenge(challenge: string): string | null {
  const payload = verifyPayload<ChallengePayload>(challenge);
  if (!payload || payload.purpose !== "2fa" || !payload.sub) return null;
  return payload.sub;
}
