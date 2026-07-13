export function isAdminReviewOverrideEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_REVIEW_OVERRIDE?.toLowerCase() === "yes";
}

export function canAccessAdminReview(userRole?: string | null) {
  return userRole === "admin" || isAdminReviewOverrideEnabled();
}
