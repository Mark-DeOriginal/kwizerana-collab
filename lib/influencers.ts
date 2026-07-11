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

type InfluencerRow = {
  id: number;
  handle: string;
  name: string;
  bio: string;
  followers: number;
  location: string;
  language: string;
  verified: boolean;
  last_active: string;
  updated_at: string;
  confidence: number;
  engagement: Influencer["engagement"];
  audience: string;
  recent_signal: string;
  avatar_color: string;
  profile_image_url: string | null;
  profile_url: string | null;
  tags: Niche[] | null;
};

type CountRow = {
  count: number;
};

const defaultInfluencers: Array<Omit<Influencer, "id">> = [
  {
    handle: "defi_dad",
    name: "DeFi Dad",
    bio: "Educator and operator explaining DeFi primitives, protocol strategy, and responsible yield discovery.",
    followers: 156400,
    location: "United States",
    language: "English",
    verified: true,
    lastActive: "Today",
    updatedAt: "2026-07-06",
    tags: ["DeFi", "Yield", "Protocol Growth"],
    confidence: 94,
    engagement: "High",
    audience: "Builders, analysts, DeFi-native retail",
    recentSignal: "Clear educational threads on lending markets and liquid staking risk.",
    avatarColor: "#2f6f91",
    profileUrl: "https://x.com/defi_dad"
  },
  {
    handle: "stable_sam",
    name: "Samira Cole",
    bio: "Stablecoin policy, payments rails, emerging market adoption, and onchain FX research.",
    followers: 48200,
    location: "United Kingdom",
    language: "English",
    verified: false,
    lastActive: "Today",
    updatedAt: "2026-07-04",
    tags: ["Stablecoins", "RWA", "DeFi"],
    confidence: 91,
    engagement: "Medium",
    audience: "Fintech founders, protocol BD, policy watchers",
    recentSignal: "Frequent commentary on treasury-backed assets and wallet-based remittance flows.",
    avatarColor: "#d76b55",
    profileUrl: "https://x.com/stable_sam"
  },
  {
    handle: "rwa_ops",
    name: "Marcus Adebayo",
    bio: "Tokenized credit markets, RWA operations, private credit risk, and institutional DeFi distribution.",
    followers: 27100,
    location: "Nigeria",
    language: "English",
    verified: false,
    lastActive: "Yesterday",
    updatedAt: "2026-07-05",
    tags: ["RWA", "DeFi", "Protocol Growth"],
    confidence: 89,
    engagement: "Emerging",
    audience: "RWA teams, African fintech, institutional DeFi",
    recentSignal: "Discusses underwriting discipline and onchain reporting for credit vaults.",
    avatarColor: "#e9b44c",
    profileUrl: "https://x.com/rwa_ops"
  },
  {
    handle: "l2_mina",
    name: "Mina Park",
    bio: "Layer 2 ecosystem mapping, sequencing debates, appchain GTM, and bridge UX.",
    followers: 91400,
    location: "South Korea",
    language: "English",
    verified: true,
    lastActive: "Today",
    updatedAt: "2026-07-03",
    tags: ["L2", "Ethereum", "Protocol Growth"],
    confidence: 96,
    engagement: "High",
    audience: "Protocol founders, infrastructure teams, devrel",
    recentSignal: "Strong signal around L2 migration campaigns and liquidity incentives.",
    avatarColor: "#5a4b7f",
    profileUrl: "https://x.com/l2_mina"
  },
  {
    handle: "vaultwatch",
    name: "Theo Mensah",
    bio: "Independent risk notes on vault design, yield claims, oracle dependencies, and smart contract exposure.",
    followers: 18700,
    location: "Ghana",
    language: "English",
    verified: false,
    lastActive: "This week",
    updatedAt: "2026-06-30",
    tags: ["Security", "Yield", "DeFi"],
    confidence: 88,
    engagement: "Medium",
    audience: "Yield desks, auditors, risk-minded users",
    recentSignal: "Flags risk disclosures and explains liquidation edge cases in plain language.",
    avatarColor: "#506b43",
    profileUrl: "https://x.com/vaultwatch"
  },
  {
    handle: "btc_ledger",
    name: "Iris Nolan",
    bio: "Bitcoin market structure, custody, treasury adoption, and long-cycle investor psychology.",
    followers: 223900,
    location: "Canada",
    language: "English",
    verified: true,
    lastActive: "Today",
    updatedAt: "2026-07-06",
    tags: ["Bitcoin", "Trading"],
    confidence: 86,
    engagement: "High",
    audience: "Macro investors, Bitcoin builders, fund analysts",
    recentSignal: "Posts daily notes on ETF flows, custody narratives, and market positioning.",
    avatarColor: "#182026",
    profileUrl: "https://x.com/btc_ledger"
  },
  {
    handle: "dao_jules",
    name: "Jules Verma",
    bio: "DAO contributor systems, governance design, incentive alignment, and community-led protocol growth.",
    followers: 36400,
    location: "India",
    language: "English",
    verified: false,
    lastActive: "Yesterday",
    updatedAt: "2026-07-02",
    tags: ["DAO", "Protocol Growth", "DeFi"],
    confidence: 84,
    engagement: "Medium",
    audience: "Community leads, governance delegates, operators",
    recentSignal: "Useful takes on contributor funnels and governance participation quality.",
    avatarColor: "#2f6f91",
    profileUrl: "https://x.com/dao_jules"
  },
  {
    handle: "aiyield_lab",
    name: "Nora Stein",
    bio: "Researching AI agents for DeFi routing, portfolio automation, and safer onchain execution.",
    followers: 65800,
    location: "Germany",
    language: "English",
    verified: true,
    lastActive: "Today",
    updatedAt: "2026-07-01",
    tags: ["AI x Crypto", "Yield", "DeFi"],
    confidence: 90,
    engagement: "High",
    audience: "Agent builders, yield strategists, infra teams",
    recentSignal: "Explores policy-based agents for deposits, rebalancing, and automated risk checks.",
    avatarColor: "#d76b55",
    profileUrl: "https://x.com/aiyield_lab"
  }
];

let seedPromise: Promise<void> | undefined;

function mapInfluencer(row: InfluencerRow): Influencer {
  return {
    id: Number(row.id),
    handle: row.handle,
    name: row.name,
    bio: row.bio,
    followers: Number(row.followers),
    location: row.location,
    language: row.language,
    verified: Boolean(row.verified),
    lastActive: row.last_active,
    updatedAt: new Date(row.updated_at).toISOString().slice(0, 10),
    tags: (row.tags ?? []) as Niche[],
    confidence: Number(row.confidence),
    engagement: row.engagement,
    audience: row.audience,
    recentSignal: row.recent_signal,
    avatarColor: row.avatar_color,
    profileImageUrl: row.profile_image_url ?? undefined,
    profileUrl: row.profile_url ?? undefined
  };
}

async function seedInfluencersIfNeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ensureDatabase();
      const [row] = await dbQuery<CountRow>("SELECT COUNT(*)::int AS count FROM influencers");

      if (Number(row?.count ?? 0) > 0) return;

      for (const influencer of defaultInfluencers) {
        const [inserted] = await dbQuery<{ id: number }>(
          `INSERT INTO influencers (
            handle, name, bio, followers, location, language, verified,
            last_active, updated_at, confidence, engagement, audience,
            recent_signal, avatar_color, profile_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id`,
          [
            influencer.handle,
            influencer.name,
            influencer.bio,
            influencer.followers,
            influencer.location,
            influencer.language,
            influencer.verified,
            influencer.lastActive,
            influencer.updatedAt,
            influencer.confidence,
            influencer.engagement,
            influencer.audience,
            influencer.recentSignal,
            influencer.avatarColor,
            influencer.profileUrl ?? `https://x.com/${influencer.handle}`
          ]
        );

        for (const niche of influencer.tags) {
          await dbQuery(
            `INSERT INTO influencer_niches (influencer_id, niche)
             VALUES ($1, $2)
             ON CONFLICT (influencer_id, niche) DO NOTHING`,
            [inserted.id, niche]
          );
        }
      }
    })();
  }

  await seedPromise;
}

export async function listInfluencers() {
  await seedInfluencersIfNeeded();

  const rows = await dbQuery<InfluencerRow>(
    `SELECT
       i.id,
       i.handle,
       i.name,
       i.bio,
       i.followers,
       i.location,
       i.language,
       i.verified,
       i.last_active,
       i.updated_at,
       i.confidence,
       i.engagement,
       i.audience,
       i.recent_signal,
       i.avatar_color,
       i.profile_image_url,
       i.profile_url,
       COALESCE(array_agg(n.niche ORDER BY n.niche) FILTER (WHERE n.niche IS NOT NULL), ARRAY[]::TEXT[]) AS tags
     FROM influencers i
     LEFT JOIN influencer_niches n ON n.influencer_id = i.id
     WHERE i.status = 'active'
     GROUP BY i.id
     ORDER BY i.followers DESC, i.id ASC`
  );

  return rows.map(mapInfluencer);
}

export async function getArchiveStats(): Promise<ArchiveStats> {
  await seedInfluencersIfNeeded();

  const [influencerCount, pendingCount, userCount, confidence] = await Promise.all([
    dbQuery<CountRow>("SELECT COUNT(*)::int AS count FROM influencers WHERE status = 'active'"),
    dbQuery<CountRow>("SELECT COUNT(*)::int AS count FROM submissions WHERE status IN ('pending', 'needs_review')"),
    dbQuery<CountRow>("SELECT COUNT(*)::int AS count FROM users"),
    dbQuery<{ avg_confidence: number | null }>("SELECT ROUND(AVG(confidence))::int AS avg_confidence FROM influencers WHERE status = 'active'")
  ]);

  return {
    totalInfluencers: Number(influencerCount[0]?.count ?? 0),
    pendingSubmissions: Number(pendingCount[0]?.count ?? 0),
    totalUsers: Number(userCount[0]?.count ?? 0),
    avgConfidence: Number(confidence[0]?.avg_confidence ?? 0)
  };
}

export async function upsertInfluencerProfile(input: {
  profile: TwitterProfile;
  tags: Niche[];
  sourceSubmissionId?: string;
}) {
  await seedInfluencersIfNeeded();

  const engagement: Influencer["engagement"] =
    input.profile.followers > 100000 ? "High" : input.profile.followers > 25000 ? "Medium" : "Emerging";

  const [row] = await dbQuery<{ id: number }>(
    `INSERT INTO influencers (
      handle, name, bio, followers, following, location, language, verified,
      last_active, updated_at, confidence, engagement, audience, recent_signal,
      avatar_color, profile_image_url, profile_url, source_submission_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active')
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
        status = 'active'
    RETURNING id`,
    [
      input.profile.handle,
      input.profile.name,
      input.profile.bio,
      input.profile.followers,
      input.profile.following ?? null,
      input.profile.location,
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
      input.sourceSubmissionId ?? null
    ]
  );

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
