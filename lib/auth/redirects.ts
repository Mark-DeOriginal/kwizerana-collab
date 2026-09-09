const DEFAULT_SIGNED_IN_PATH = "/dashboard";

export function safeReturnPath(value: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "https://kwizerana.local");
    if (parsed.origin !== "https://kwizerana.local") return fallback;
    if (parsed.pathname === "/redirect" || parsed.pathname.startsWith("/auth/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authHref(path: "/auth/sign-in" | "/auth/sign-up", returnTo?: string | null): string {
  const next = safeReturnPath(returnTo);
  return `${path}?next=${encodeURIComponent(next)}`;
}
