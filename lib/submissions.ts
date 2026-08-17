import { getUserByEmail } from "@/lib/users";
import { Niche, upsertInfluencerProfile } from "@/lib/influencers";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { fetchTwitterProfile, inferNiches, TwitterProfile } from "@/lib/twitter-profile";

export type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_review";

export type InfluencerSubmission = {
  id: string;
  profileUrl: string;
  submittedNiches: Niche[];
  suggestedNiches: Niche[];
  submitterEmail: string;
  note: string;
  status: SubmissionStatus;
  createdAt: string;
  reviewedAt?: string;
  profile: TwitterProfile;
  riskFlags: string[];
  location?: string;
  commentary?: string;
};

type SubmissionRow = {
  id: string;
  profile_url: string;
  submitted_niches: Niche[];
  suggested_niches: Niche[];
  submitter_email: string;
  note: string;
  status: SubmissionStatus;
  created_at: string;
  reviewed_at: string | null;
  profile_handle: string;
  profile_name: string;
  profile_bio: string;
  profile_followers: number;
  profile_following: number | null;
  location: string | null;
  profile_location: string;
  profile_language: string;
  profile_verified: boolean;
  profile_image_url: string | null;
  profile_updated_at: string;
  recent_signal: string;
  risk_flags: string[];
  commentary: string | null;
};

function mapSubmission(row: SubmissionRow): InfluencerSubmission {
  return {
    id: row.id,
    profileUrl: row.profile_url,
    submittedNiches: (row.submitted_niches ?? []) as Niche[],
    suggestedNiches: (row.suggested_niches ?? []) as Niche[],
    submitterEmail: row.submitter_email,
    note: row.note,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
    riskFlags: row.risk_flags ?? [],
    location: row.location || undefined,
    commentary: row.commentary || undefined,
    profile: {
      handle: row.profile_handle,
      name: row.profile_name,
      bio: row.profile_bio,
      followers: Number(row.profile_followers),
      following: row.profile_following ?? undefined,
      location: row.profile_location,
      language: row.profile_language,
      verified: Boolean(row.profile_verified),
      profileImageUrl: row.profile_image_url ?? undefined,
      profileUrl: row.profile_url,
      updatedAt: new Date(row.profile_updated_at).toISOString(),
      recentSignal: row.recent_signal
    }
  };
}

export type SubmissionSortKey = "newest" | "pending" | "approved" | "followers" | "no_commentary";

export type SubmissionListFilters = {
  search?: string;
  sortBy?: SubmissionSortKey;
  page?: number;
  limit?: number;
};

export type SubmissionListResult = {
  submissions: InfluencerSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function listSubmissions(filters: SubmissionListFilters = {}): Promise<SubmissionListResult> {
  await ensureDatabase();

  const { search, sortBy = "newest", page = 1, limit = 15 } = filters;
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const offset = (page - 1) * safeLimit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  const q = search?.trim().toLowerCase();
  if (q) {
    const likeParam = `$${params.length + 1}`;
    conditions.push(
      `(LOWER(s.profile_handle) LIKE ${likeParam} OR LOWER(s.profile_name) LIKE ${likeParam} OR LOWER(s.profile_bio) LIKE ${likeParam} OR LOWER(s.submitter_email) LIKE ${likeParam} OR LOWER(s.note) LIKE ${likeParam} OR LOWER(COALESCE(i.commentary, '')) LIKE ${likeParam})`
    );
    params.push(`%${q}%`);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderSql = "s.created_at DESC";
  switch (sortBy) {
    case "pending":
      orderSql = `CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END, s.created_at DESC`;
      break;
    case "approved":
      orderSql = `CASE WHEN s.status = 'approved' THEN 0 ELSE 1 END, s.created_at DESC`;
      break;
    case "followers":
      orderSql = `s.profile_followers DESC, s.created_at DESC`;
      break;
    case "no_commentary":
      orderSql = `CASE WHEN COALESCE(i.commentary, '') = '' THEN 0 ELSE 1 END, s.created_at DESC`;
      break;
    case "newest":
      orderSql = `s.created_at DESC`;
      break;
  }

  const joinSql = `FROM submissions s LEFT JOIN influencers i ON i.source_submission_id = s.id`;

  const [countRow] = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count ${joinSql} ${whereSql}`,
    params
  );
  const total = Number(countRow?.count ?? "0");

  const rows = await dbQuery<SubmissionRow>(
    `SELECT s.*, i.location, i.commentary ${joinSql} ${whereSql} ORDER BY ${orderSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, safeLimit, offset]
  );

  return {
    submissions: rows.map(mapSubmission),
    total,
    page,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit))
  };
}

export async function createSubmission(input: {
  profileUrl: string;
  niches: Niche[];
  submitterEmail: string;
  note: string;
}) {
  await ensureDatabase();

  const profile = await fetchTwitterProfile(input.profileUrl);

  const handleLower = profile.handle.toLowerCase();
  const [existingArchived] = await dbQuery<{ id: string }>(
    `SELECT id FROM influencers WHERE LOWER(handle) = $1 LIMIT 1`,
    [handleLower]
  );
  if (existingArchived) {
    throw new Error("This profile already exists in the archive.");
  }

  const [existingSubmission] = await dbQuery<{ id: string }>(
    `SELECT id FROM submissions WHERE LOWER(profile_handle) = $1 AND status IN ('pending', 'approved', 'needs_review') LIMIT 1`,
    [handleLower]
  );
  if (existingSubmission) {
    throw new Error("This profile has already been submitted and is under review.");
  }

  const suggestedNiches = inferNiches(profile, input.niches);
  const riskFlags = [
    profile.followers > 0 && profile.followers < 10000 ? "Below 10k followers." : "",
    profile.bio.length < 20 ? "Sparse bio, requires manual relevance check." : "",
    suggestedNiches.length === 0 ? "No niche confidence generated." : ""
  ].filter(Boolean);

  const submitter = await getUserByEmail(input.submitterEmail);
  const id = `sub_${crypto.randomUUID()}`;

  const [row] = await dbQuery<SubmissionRow>(
    `INSERT INTO submissions (
      id,
      profile_url,
      submitted_niches,
      suggested_niches,
      submitter_email,
      submitter_user_id,
      note,
      status,
      profile_handle,
      profile_name,
      profile_bio,
      profile_followers,
      profile_following,
      profile_location,
      profile_language,
      profile_verified,
      profile_image_url,
      profile_updated_at,
      recent_signal,
      risk_flags
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    )
    RETURNING *`,
    [
      id,
      profile.profileUrl,
      input.niches,
      suggestedNiches,
      input.submitterEmail,
      submitter?.id ?? null,
      input.note,
      riskFlags.length ? "needs_review" : "pending",
      profile.handle,
      profile.name,
      profile.bio,
      profile.followers,
      profile.following ?? null,
      profile.location,
      profile.language,
      profile.verified,
      profile.profileImageUrl ?? null,
      profile.updatedAt,
      profile.recentSignal,
      riskFlags
    ]
  );

  return mapSubmission(row);
}

export async function updateSubmissionStatus(id: string, status: SubmissionStatus, meta?: { location?: string; commentary?: string }) {
  await ensureDatabase();

  const [updated] = await dbQuery<SubmissionRow>(
    `UPDATE submissions
     SET status = $2,
         reviewed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  );

  if (!updated) return null;

  const submission = mapSubmission(updated);

  if (status === "approved") {
    try {
      await upsertInfluencerProfile({
        profile: submission.profile,
        tags: submission.suggestedNiches,
        sourceSubmissionId: submission.id,
        influencerLocation: meta?.location,
        commentary: meta?.commentary,
      });
    } catch (error) {
      console.error("Failed to upsert influencer profile:", error);
    }
  } else if (status === "rejected") {
    try {
      await dbQuery(
        `UPDATE influencers SET status = 'inactive' WHERE source_submission_id = $1`,
        [submission.id]
      );
    } catch (error) {
      console.error("Failed to deactivate influencer:", error);
    }
  }

  return submission;
}
