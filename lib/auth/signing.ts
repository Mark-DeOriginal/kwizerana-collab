import { createHmac, timingSafeEqual } from "crypto";

function getSigningSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured.");
  }
  return secret;
}

export function signPayload(payload: Record<string, unknown>, ttlSeconds: number): string {
  const secret = getSigningSecret();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = `${body}.${exp}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string): T | null {
  const secret = getSigningSecret();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [body, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const data = `${body}.${expStr}`;
  const expected = createHmac("sha256", secret).update(data).digest("base64url");

  const received = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (received.length !== expectedBuf.length || !timingSafeEqual(received, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
