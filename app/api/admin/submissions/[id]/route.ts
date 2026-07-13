import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isAdminReviewOverrideEnabled } from "@/lib/admin-review-access";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { SubmissionStatus, updateSubmissionStatus } from "@/lib/submissions";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();

  if (!allowDevAdmin && !allowOverride && !isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const status = body.status as SubmissionStatus;

  if (!["approved", "rejected", "needs_review", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const submission = await updateSubmissionStatus(params.id, status);
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  return NextResponse.json({ data: submission });
}
