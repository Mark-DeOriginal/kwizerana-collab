import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isAdminReviewOverrideEnabled } from "@/lib/admin-review-access";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { getUserByEmail } from "@/lib/users";
import { SubmissionStatus, updateSubmissionStatus } from "@/lib/submissions";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const sql = neon(connectionString);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();

  const currentUser = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  const isAllowed = allowDevAdmin || allowOverride || isAdminEmail(session?.user?.email) || currentUser?.role === "admin";

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "edit") {
    try {
      if (body.niches !== undefined) {
        await sql`UPDATE submissions SET suggested_niches = ${body.niches} WHERE id = ${params.id}`;
      }

      const updated = await sql`UPDATE influencers
        SET location = ${body.location ?? ""}, commentary = ${body.commentary ?? ""}, updated_at = NOW()
        WHERE source_submission_id = ${params.id}
        RETURNING id`;

      const submission = await sql`SELECT * FROM submissions WHERE id = ${params.id} LIMIT 1`;
      if (!submission || submission.length === 0) {
        return NextResponse.json({ error: "Submission not found." }, { status: 404 });
      }

      return NextResponse.json({ data: { id: params.id, niches: body.niches, location: body.location, commentary: body.commentary } });
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();

  const currentUser = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  const isAllowed = allowDevAdmin || allowOverride || isAdminEmail(session?.user?.email) || currentUser?.role === "admin";

  if (!isAllowed) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const deleted = await sql`DELETE FROM submissions WHERE id = ${params.id} RETURNING id`;
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("Failed to delete submission:", error);
    return NextResponse.json({ error: "Failed to delete submission." }, { status: 500 });
  }
}
