import { dbQuery, ensureDatabase } from "@/lib/db";

export async function getAntiPhishingCode(userId: string): Promise<string> {
  await ensureDatabase();
  const rows = await dbQuery<{ anti_phishing_code: string }>(
    `SELECT anti_phishing_code FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0]?.anti_phishing_code ?? "";
}

export async function setAntiPhishingCode(userId: string, code: string): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE users SET anti_phishing_code = $2, updated_at = NOW() WHERE id = $1`,
    [userId, code]
  );
}

export function validateAntiPhishingCode(code: string): string | null {
  if (!code) return "Anti-phishing code is required.";
  if (code.length < 4) return "Anti-phishing code must be at least 4 characters.";
  if (code.length > 32) return "Anti-phishing code must be at most 32 characters.";
  if (!/^[\x20-\x7E]+$/.test(code)) return "Anti-phishing code must use printable characters only.";
  return null;
}
