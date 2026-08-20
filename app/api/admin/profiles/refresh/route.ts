import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { isAdminReviewOverrideEnabled } from "@/lib/admin-review-access";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/roles";
import { getUserByEmail } from "@/lib/users";
import { fetchTwitterProfile } from "@/lib/twitter-profile";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const sql = neon(connectionString, { fetchOptions: { headersTimeout: 60000, bodyTimeout: 60000 } });

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const allowDevAdmin = process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLIENT_ID;
  const allowOverride = isAdminReviewOverrideEnabled();
  const currentUser = session?.user?.email ? await getUserByEmail(session.user.email) : null;
  const isAllowed = allowDevAdmin || allowOverride || isAdminEmail(session?.user?.email) || currentUser?.role === "admin";

  if (!isAllowed) {
    return null;
  }
  return true;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const rows = await sql`SELECT handle FROM influencers ORDER BY id ASC`;
  return NextResponse.json({ data: rows.map((r) => r.handle as string) });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";

  if (!handle) {
    return NextResponse.json({ error: "Missing handle." }, { status: 400 });
  }

  try {
    const profile = await fetchTwitterProfile(handle);

    const freshLocation = profile.location && profile.location !== "Unknown" ? profile.location : null;

    await sql`UPDATE influencers SET
      name = ${profile.name},
      bio = ${profile.bio},
      followers = ${profile.followers},
      following = ${profile.following ?? null},
      location = COALESCE(${freshLocation}, location),
      language = ${profile.language},
      verified = ${profile.verified},
      profile_image_url = ${profile.profileImageUrl ?? null},
      profile_url = ${profile.profileUrl},
      recent_signal = ${profile.recentSignal},
      updated_at = NOW()
      WHERE LOWER(handle) = LOWER(${handle})`;

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
        profileUrl: profile.profileUrl,
        updatedAt: profile.updatedAt,
        recentSignal: profile.recentSignal,
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to refresh profile.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
