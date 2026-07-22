export function isAdminReviewOverrideEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_REVIEW_OVERRIDE?.toLowerCase() === "yes";
}

export function canAccessAdminReview(userRole?: string | null, permissions?: string[]) {
  if (isAdminReviewOverrideEnabled()) return true;
  if (permissions?.includes("view_dashboard")) return true;
  return false;
}
