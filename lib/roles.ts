export type UserRole = "admin" | "member";

export const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function resolveUserRole(email?: string | null): UserRole {
  return isAdminEmail(email) ? "admin" : "member";
}
