export type UserRole = "admin" | "member";

export type Permission = "manage_admins" | "remove_profiles" | "view_dashboard";

export const ALL_PERMISSIONS: Permission[] = ["manage_admins", "remove_profiles", "view_dashboard"];

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

export function hasPermission(userRole: UserRole, permissions: Permission[], permission: Permission) {
  return permissions.includes(permission);
}
