export type UserRole = "admin" | "member";

export type Permission = "manage_admins" | "remove_profiles" | "view_dashboard" | "manage_disputes";

export const ALL_PERMISSIONS: Permission[] = ["manage_admins", "remove_profiles", "view_dashboard", "manage_disputes"];

const DASHBOARD_DEPENDENT_PERMISSIONS: Permission[] = ["manage_admins", "manage_disputes"];

/** Keeps stored permission sets internally consistent before they are persisted. */
export function normalizeAdminPermissions(permissions: Permission[]): Permission[] {
  const valid = Array.from(new Set(permissions.filter((permission) => ALL_PERMISSIONS.includes(permission))));
  if (valid.includes("view_dashboard")) return valid;
  return valid.filter((permission) => !DASHBOARD_DEPENDENT_PERMISSIONS.includes(permission));
}

export const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function isSuperAdmin(email?: string | null) {
  return isAdminEmail(email);
}

export function resolveUserRole(email?: string | null): UserRole {
  return isAdminEmail(email) ? "admin" : "member";
}

export function hasPermission(_userRole: UserRole, permissions: Permission[], permission: Permission) {
  if (!permissions.includes(permission)) return false;
  return !DASHBOARD_DEPENDENT_PERMISSIONS.includes(permission) || permissions.includes("view_dashboard");
}
