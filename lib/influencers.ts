import { dbQuery, ensureDatabase } from "@/lib/db";
import type { TwitterProfile } from "@/lib/twitter-profile";

export type Niche =
  | "DeFi"
  | "Yield"
  | "Stablecoins"
  | "RWA"
  | "Protocol Growth"
  | "Trading"
  | "Ethereum"
  | "Bitcoin"
  | "Security"
  | "DAO"
  | "L2"
  | "AI x Crypto";

export type Influencer = {
  id: number;
  handle: string;
  name: string;
  bio: string;
  followers: number;
  location: string;
  language: string;
  verified: boolean;
  lastActive: string;
  updatedAt: string;
  tags: Niche[];
  confidence: number;
  engagement: "High" | "Medium" | "Emerging";
  audience: string;
  recentSignal: string;
  avatarColor: string;
  profileImageUrl?: string;
  profileUrl?: string;
  commentary?: string;
  saved?: boolean;
};

export const niches: Niche[] = [
  "DeFi",
  "Yield",
  "Stablecoins",
  "RWA",
  "Protocol Growth",
  "Trading",
  "Ethereum",
  "Bitcoin",
  "Security",
  "DAO",
  "L2",
  "AI x Crypto"
];

export type ArchiveStats = {
  totalInfluencers: number;
  pendingSubmissions: number;
  totalUsers: number;
  avgConfidence: number;
};

export async function upsertInfluencerProfile(input: {
  profile: TwitterProfile;
  tags: Niche[];
  sourceSubmissionId?: string;
  influencerLocation?: string;
  commentary?: string;
}) {
  await ensureDatabase();

  const engagement: Influencer["engagement"] =
    input.profile.followers > 100000 ? "High" : input.profile.followers > 25000 ? "Medium" : "Emerging";

  const [row] = await dbQuery<{ id: number }>(
    `INSERT INTO influencers (
      handle, name, bio, followers, following, location, language, verified,
      last_active, updated_at, confidence, engagement, audience, recent_signal,
      avatar_color, profile_image_url, profile_url, source_submission_id, status,
      commentary
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active', $19)
    ON CONFLICT (handle) DO UPDATE
    SET name = EXCLUDED.name,
        bio = EXCLUDED.bio,
        followers = EXCLUDED.followers,
        following = EXCLUDED.following,
        location = EXCLUDED.location,
        language = EXCLUDED.language,
        verified = EXCLUDED.verified,
        last_active = EXCLUDED.last_active,
        updated_at = EXCLUDED.updated_at,
        confidence = EXCLUDED.confidence,
        engagement = EXCLUDED.engagement,
        audience = EXCLUDED.audience,
        recent_signal = EXCLUDED.recent_signal,
        avatar_color = EXCLUDED.avatar_color,
        profile_image_url = EXCLUDED.profile_image_url,
        profile_url = EXCLUDED.profile_url,
        source_submission_id = EXCLUDED.source_submission_id,
        status = 'active',
        commentary = EXCLUDED.commentary
    RETURNING id`,
    [
      input.profile.handle,
      input.profile.name,
      input.profile.bio,
      input.profile.followers,
      input.profile.following ?? null,
      input.influencerLocation || input.profile.location,
      input.profile.language,
      input.profile.verified,
      "Recently checked",
      input.profile.updatedAt,
      Math.min(96, 72 + input.tags.length * 4),
      engagement,
      "Pending admin review",
      input.profile.recentSignal,
      "#2f6f91",
      input.profile.profileImageUrl ?? null,
      input.profile.profileUrl,
      input.sourceSubmissionId ?? null,
      input.commentary ?? ""
    ]
  );

  if (!row) throw new Error("Failed to insert influencer profile");

  await dbQuery("DELETE FROM influencer_niches WHERE influencer_id = $1", [row.id]);

  for (const niche of input.tags) {
    await dbQuery(
      `INSERT INTO influencer_niches (influencer_id, niche)
       VALUES ($1, $2)
       ON CONFLICT (influencer_id, niche) DO NOTHING`,
      [row.id, niche]
    );
  }
}
