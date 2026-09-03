export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unconfigured (e.g. local dev) — allow
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
