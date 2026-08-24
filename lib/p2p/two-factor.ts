import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "crypto";
import { dbQuery, ensureDatabase } from "@/lib/db";

const AES_ALGORITHM = "aes-256-gcm";
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = encrypted.split(".");
  const decipher = createDecipheriv(AES_ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const byte = input[i];
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const index = BASE32_ALPHABET.indexOf(clean[i]);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function generateTotpAt(secret: string, timestampMs: number): string {
  const counter = Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function generateOtpauthUrl(secret: string, email: string, issuer = "Kwizerana"): string {
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS)
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function verifyTotpCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;

  const now = Date.now();
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const candidate = generateTotpAt(secret, now + offset * TOTP_PERIOD_SECONDS * 1000);
    if (safeEqualStrings(candidate, code)) return true;
  }

  return false;
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = randomBytes(4).toString("hex").toUpperCase();
    const b = randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${a.slice(0, 4)}-${b.slice(0, 4)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase().replace(/\s+/g, "")).digest("hex");
}

export type TwoFactorStatus = {
  enabled: boolean;
  confirmedAt: string | null;
  hasPendingSetup: boolean;
};

export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  await ensureDatabase();
  const rows = await dbQuery<{ totp_enabled: boolean; totp_confirmed_at: string | null; totp_secret_encrypted: string | null }>(
    `SELECT totp_enabled, totp_confirmed_at, totp_secret_encrypted FROM users WHERE id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    enabled: Boolean(row?.totp_enabled),
    confirmedAt: row?.totp_confirmed_at ?? null,
    hasPendingSetup: Boolean(row?.totp_secret_encrypted && !row.totp_enabled)
  };
}

export async function storePendingSecret(userId: string, secret: string): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE users SET totp_secret_encrypted = $2, totp_enabled = FALSE, totp_confirmed_at = NULL, updated_at = NOW() WHERE id = $1`,
    [userId, encryptSecret(secret)]
  );
}

export async function getStoredSecret(userId: string): Promise<string | null> {
  await ensureDatabase();
  const rows = await dbQuery<{ totp_secret_encrypted: string | null }>(
    `SELECT totp_secret_encrypted FROM users WHERE id = $1`,
    [userId]
  );
  const encrypted = rows[0]?.totp_secret_encrypted;
  if (!encrypted) return null;
  try {
    return decryptSecret(encrypted);
  } catch {
    return null;
  }
}

export async function confirmTwoFactor(userId: string, backupCodesHashed: string[]): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE users SET totp_enabled = TRUE, totp_confirmed_at = NOW(), backup_codes_hashed = $2, updated_at = NOW() WHERE id = $1`,
    [userId, backupCodesHashed]
  );
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await ensureDatabase();
  await dbQuery(
    `UPDATE users SET totp_enabled = FALSE, totp_confirmed_at = NULL, totp_secret_encrypted = NULL, backup_codes_hashed = ARRAY[]::TEXT[], updated_at = NOW() WHERE id = $1`,
    [userId]
  );
}

export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  await ensureDatabase();
  const rows = await dbQuery<{ backup_codes_hashed: string[] }>(
    `SELECT backup_codes_hashed FROM users WHERE id = $1`,
    [userId]
  );
  const hashes = rows[0]?.backup_codes_hashed ?? [];
  const target = hashBackupCode(code);
  if (!hashes.includes(target)) return false;

  await dbQuery(
    `UPDATE users SET backup_codes_hashed = $2, updated_at = NOW() WHERE id = $1`,
    [userId, hashes.filter((h) => h !== target)]
  );
  return true;
}
