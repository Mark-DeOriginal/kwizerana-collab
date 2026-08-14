import { dbQuery, ensureDatabase } from "@/lib/db";
import type { TwitterProfile } from "@/lib/twitter-profile";
import { allNiches as niches, type Niche } from "@/lib/niches";

export type { Niche };
export { niches };

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

export type ArchiveStats = {
  totalInfluencers: number;
  pendingSubmissions: number;
  totalUsers: number;
  avgConfidence: number;
};

export type ArchiveListFilters = {
  query?: string;
  minFollowers?: number;
  verifiedOnly?: boolean;
  niches?: Niche[];
  sortBy?: "match" | "followers";
  page?: number;
  limit?: number;
};

export type ArchiveListResult = {
  influencers: Influencer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type InfluencerRow = {
  id: string | number;
  handle: string;
  name: string;
  bio: string;
  followers: string | number;
  location: string;
  verified: string | boolean;
  last_active: string;
  updated_at: string;
  tags: string[];
  confidence: string | number;
  engagement: string;
  audience: string;
  recent_signal: string;
  avatar_color: string;
  profile_image_url: string | null;
  profile_url: string | null;
  commentary: string | null;
};

const influencerSelect = `i.id, i.handle, i.name, i.bio, i.followers, i.location, i.language,
  i.verified, i.last_active, i.updated_at, i.confidence, i.engagement,
  i.audience, i.recent_signal, i.avatar_color, i.profile_image_url, i.profile_url,
  i.commentary,
  COALESCE(array_agg(n.niche ORDER BY n.niche) FILTER (WHERE n.niche IS NOT NULL), ARRAY[]::TEXT[]) AS tags`;

function mapInfluencerRow(r: InfluencerRow): Influencer {
  return {
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
    tags: (r.tags ?? []) as Niche[],
    confidence: Number(r.confidence),
    engagement: (r.engagement as Influencer["engagement"]) ?? "Emerging",
    audience: r.audience,
    recentSignal: r.recent_signal,
    avatarColor: r.avatar_color,
    profileImageUrl: r.profile_image_url ?? undefined,
    profileUrl: r.profile_url ?? undefined,
    commentary: r.commentary || undefined
  };
}

export async function listArchive(filters: ArchiveListFilters = {}): Promise<ArchiveListResult> {
  await ensureDatabase();

  const { query, minFollowers = 0, verifiedOnly = false, niches = [], sortBy = "match", page = 1, limit = 30 } = filters;
  const safeLimit = Math.min(Math.max(limit, 1), 100000);
  const offset = (page - 1) * safeLimit;

  const conditions: string[] = ["i.status = 'active'"];
  const params: unknown[] = [];

  conditions.push(`i.followers >= $${params.length + 1}`);
  params.push(minFollowers);

  if (verifiedOnly) {
    conditions.push(`i.verified = TRUE`);
  }

  if (niches.length > 0) {
    conditions.push(`i.id IN (SELECT influencer_id FROM influencer_niches WHERE niche = ANY($${params.length + 1}::TEXT[]))`);
    params.push(niches);
  }

  const q = query?.trim().toLowerCase();
  if (q) {
    const likeParam = `$${params.length + 1}`;
    conditions.push(
      `(LOWER(i.handle) LIKE ${likeParam} OR LOWER(i.name) LIKE ${likeParam} OR LOWER(i.bio) LIKE ${likeParam} OR LOWER(i.location) LIKE ${likeParam} OR i.id IN (SELECT influencer_id FROM influencer_niches WHERE LOWER(niche) LIKE ${likeParam}))`
    );
    params.push(`%${q}%`);
  }

  const whereSql = conditions.join(" AND ");
  const orderSql = sortBy === "followers" ? "i.followers DESC, i.id ASC" : "i.confidence DESC, i.followers DESC, i.id ASC";

  const [countRow] = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM influencers i WHERE ${whereSql}`,
    params
  );
  const total = Number(countRow?.count ?? "0");

  const rows = await dbQuery<InfluencerRow>(
    `SELECT ${influencerSelect}
     FROM influencers i
     LEFT JOIN influencer_niches n ON n.influencer_id = i.id
     WHERE ${whereSql}
     GROUP BY i.id
     ORDER BY ${orderSql}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, offset]
  );

  return {
    influencers: rows.map(mapInfluencerRow),
    total,
    page,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit))
  };
}

export async function listInfluencersByIds(ids: number[]): Promise<Influencer[]> {
  if (ids.length === 0) return [];

  await ensureDatabase();
  const rows = await dbQuery<InfluencerRow>(
    `SELECT ${influencerSelect}
     FROM influencers i
     LEFT JOIN influencer_niches n ON n.influencer_id = i.id
     WHERE i.status = 'active' AND i.id = ANY($1::BIGINT[])
     GROUP BY i.id
     ORDER BY i.followers DESC, i.id ASC`,
    [ids]
  );

  return rows.map(mapInfluencerRow);
}

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
