import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isAdminReviewOverrideEnabled } from "@/lib/admin-review-access";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { fetchTwitterProfile } from "@/lib/twitter-profile";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const sql = neon(connectionString);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();

  if (!allowDevAdmin && !allowOverride && !isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const rows = await sql`SELECT profile_url, profile_handle FROM submissions WHERE id = ${params.id} LIMIT 1`;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const profileUrl = rows[0].profile_url as string;

  try {
    const profile = await fetchTwitterProfile(profileUrl);

    await sql`UPDATE submissions SET
      profile_name = ${profile.name},
      profile_bio = ${profile.bio},
      profile_followers = ${profile.followers},
      profile_following = ${profile.following ?? null},
      profile_location = ${profile.location},
      profile_language = ${profile.language},
      profile_verified = ${profile.verified},
      profile_image_url = ${profile.profileImageUrl ?? null},
      profile_updated_at = ${profile.updatedAt},
      recent_signal = ${profile.recentSignal}
    WHERE id = ${params.id}`;

    return NextResponse.json({
      data: {
        handle: profile.handle,
        name: profile.name,
        bio: profile.bio,
        followers: profile.followers,
        following: profile.following,
        location: profile.location,
        language: profile.language,
        verified: profile.verified,
        profileImageUrl: profile.profileImageUrl,
        updatedAt: profile.updatedAt,
        recentSignal: profile.recentSignal,
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to refresh profile.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
