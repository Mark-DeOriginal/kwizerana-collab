import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authOptions } from "@/lib/auth";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { niches, Niche } from "@/lib/influencers";
import { createSubmission, listSubmissions } from "@/lib/submissions";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!canAccessAdminReview(session?.user?.role, session?.user?.permissions)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const submissions = await listSubmissions();
  return NextResponse.json({ data: submissions });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();
  const selectedNiches = Array.isArray(body.niches) && body.niches.length > 0
    ? body.niches.filter((item: Niche) => niches.includes(item))
    : ["DeFi"];

  if (!body.profileUrl) {
    return NextResponse.json({ error: "Profile link is required." }, { status: 400 });
  }

  if (sql) {
    const handleMatch = String(body.profileUrl).match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/);
    const extractedHandle = handleMatch?.[1]?.toLowerCase();

    if (extractedHandle) {
      const existingInfluencer = await sql`SELECT id FROM influencers WHERE LOWER(handle) = ${extractedHandle} LIMIT 1`;
      if (existingInfluencer.length > 0) {
        return NextResponse.json({ error: "This profile already exists in the archive." }, { status: 409 });
      }

      const existingSubmission = await sql`SELECT id FROM submissions WHERE LOWER(profile_handle) = ${extractedHandle} AND status IN ('pending', 'approved', 'needs_review') LIMIT 1`;
      if (existingSubmission.length > 0) {
        return NextResponse.json({ error: "This profile has already been submitted and is under review." }, { status: 409 });
      }
    }
  }

  let submission;
  try {
    submission = await createSubmission({
      profileUrl: String(body.profileUrl),
      niches: selectedNiches,
      submitterEmail: session?.user?.email ?? String(body.email ?? "anonymous@local.test"),
      note: String(body.note ?? "")
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch profile data.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ data: submission }, { status: 201 });
}
