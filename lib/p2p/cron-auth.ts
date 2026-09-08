export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Local development may exercise cron routes without a secret. Production
  // must fail closed; an accidentally public expiry/rate-refresh endpoint can
  // mutate financial and market state.
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
