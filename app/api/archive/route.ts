import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("Missing DATABASE_URL");
const sql = neon(connectionString);

export async function GET() {
  try {
    const rows = await sql`SELECT
      i.id, i.handle, i.name, i.bio, i.followers, i.location, i.language,
      i.verified, i.last_active, i.updated_at, i.confidence, i.engagement,
      i.audience, i.recent_signal, i.avatar_color, i.profile_image_url, i.profile_url,
      i.commentary,
      COALESCE(array_agg(n.niche ORDER BY n.niche) FILTER (WHERE n.niche IS NOT NULL), ARRAY[]::TEXT[]) AS tags
    FROM influencers i
    LEFT JOIN influencer_niches n ON n.influencer_id = i.id
    WHERE i.status = 'active'
    GROUP BY i.id
    ORDER BY i.followers DESC, i.id ASC`;

    const influencers = rows.map((r: any) => ({
      id: Number(r.id),
      handle: r.handle,
      name: r.name,
      bio: r.bio,
      followers: Number(r.followers),
      location: r.location,
      language: "English",
      verified: Boolean(r.verified),
      lastActive: r.last_active,
      updatedAt: new Date(r.updated_at).toISOString().slice(0, 10),
      tags: (r.tags ?? []) as string[],
      confidence: Number(r.confidence),
      engagement: r.engagement,
      audience: r.audience,
      recentSignal: r.recent_signal,
      avatarColor: r.avatar_color,
      profileImageUrl: r.profile_image_url ?? undefined,
      profileUrl: r.profile_url ?? undefined,
      commentary: r.commentary || undefined,
    }));

    return NextResponse.json({
      data: {
        influencers,
        stats: { totalInfluencers: influencers.length, pendingSubmissions: 0, totalUsers: 0, avgConfidence: 0 },
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load profiles. Please check your internet connection and try again." },
      { status: 500 }
    );
  }
}
