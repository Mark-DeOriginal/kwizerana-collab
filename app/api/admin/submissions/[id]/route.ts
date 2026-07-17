import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isAdminReviewOverrideEnabled } from "@/lib/admin-review-access";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { SubmissionStatus, updateSubmissionStatus } from "@/lib/submissions";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const sql = neon(connectionString);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();

  if (!allowDevAdmin && !allowOverride && !isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "edit") {
    try {
      const updated = await sql`UPDATE influencers
        SET location = ${body.location ?? ""}, commentary = ${body.commentary ?? ""}, updated_at = NOW()
        WHERE source_submission_id = ${params.id}
        RETURNING id`;

      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: "Approved profile not found." }, { status: 404 });
      }

      return NextResponse.json({ data: { id: updated[0].id, location: body.location, commentary: body.commentary } });
    } catch (error) {
      console.error("Failed to edit profile:", error);
      return NextResponse.json({ error: "Failed to edit profile." }, { status: 500 });
    }
  }

  const status = body.status as SubmissionStatus;

  if (!["approved", "rejected", "needs_review", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  try {
    const submission = await updateSubmissionStatus(params.id, status, {
      location: body.location,
      commentary: body.commentary,
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    return NextResponse.json({ data: submission });
  } catch (error) {
    console.error("Failed to update submission:", error);
    return NextResponse.json({ error: "Failed to update submission." }, { status: 500 });
  }
}
