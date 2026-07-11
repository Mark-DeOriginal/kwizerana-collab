import type { Influencer, Niche } from "@/lib/influencers";

export type TwitterProfile = {
  handle: string;
  name: string;
  bio: string;
  followers: number;
  following?: number;
  location: string;
  language: string;
  verified: boolean;
  profileImageUrl?: string;
  profileUrl: string;
  updatedAt: string;
  recentSignal: string;
};

const fallbackProfiles: Record<string, TwitterProfile> = {
  defi_dad: {
    handle: "defi_dad",
    name: "DeFi Dad",
    bio: "Educator and operator explaining DeFi primitives, protocol strategy, and responsible yield discovery.",
    followers: 156400,
    following: 1890,
    location: "United States",
    language: "English",
    verified: true,
    profileUrl: "https://x.com/defi_dad",
    updatedAt: new Date().toISOString(),
    recentSignal: "Recent public profile data suggests strong relevance for DeFi education and protocol growth."
  },
  thedefinvestor: {
    handle: "thedefinvestor",
    name: "The DeFi Investor",
    bio: "Curated DeFi research, narratives, airdrops, yield opportunities, and market notes.",
    followers: 310000,
    following: 1210,
    location: "Global",
    language: "English",
    verified: true,
    profileUrl: "https://x.com/thedefinvestor",
    updatedAt: new Date().toISOString(),
    recentSignal: "Likely fit for DeFi, yield discovery, trading narratives, and retail crypto education."
  },
  stani: {
    handle: "stani",
    name: "Stani",
    bio: "Founder, builder, and contributor across DeFi, social, and open financial networks.",
    followers: 260000,
    following: 980,
    location: "Europe",
    language: "English",
    verified: true,
    profileUrl: "https://x.com/stani",
    updatedAt: new Date().toISOString(),
    recentSignal: "Founder-level account with high protocol relevance and strong ecosystem distribution."
  }
};

export function extractTwitterHandle(input: string) {
  const cleanInput = input.trim();
  const directHandle = cleanInput.match(/^@?([A-Za-z0-9_]{1,15})$/);
  if (directHandle) return directHandle[1].toLowerCase();

  const urlHandle = cleanInput.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})/i);
  if (urlHandle) return urlHandle[1].toLowerCase();

  return null;
}

export function inferNiches(profile: Pick<TwitterProfile, "bio" | "name">, submittedNiches: Niche[]) {
  const text = `${profile.name} ${profile.bio}`.toLowerCase();
  const inferred = new Set<Niche>(submittedNiches);

  const checks: Array<[Niche, string[]]> = [
    ["DeFi", ["defi", "lending", "liquidity", "protocol"]],
    ["Yield", ["yield", "vault", "staking", "farm"]],
    ["Stablecoins", ["stablecoin", "payments", "remittance"]],
    ["RWA", ["rwa", "tokenized", "credit", "treasury"]],
    ["Protocol Growth", ["growth", "founder", "community", "ecosystem"]],
    ["Trading", ["trading", "market", "alpha", "chart"]],
    ["Ethereum", ["ethereum", "evm", "solidity"]],
    ["Bitcoin", ["bitcoin", "btc"]],
    ["Security", ["security", "audit", "risk", "oracle"]],
    ["DAO", ["dao", "governance", "delegate"]],
    ["L2", ["layer 2", "l2", "rollup"]],
    ["AI x Crypto", ["ai", "agent", "automation"]]
  ];

  checks.forEach(([niche, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) inferred.add(niche);
  });

  return Array.from(inferred).slice(0, 5);
}

export async function fetchTwitterProfile(input: string): Promise<TwitterProfile> {
  const handle = extractTwitterHandle(input);
  if (!handle) {
    throw new Error("Enter a valid X/Twitter profile link or handle.");
  }

  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  const baseUrl = process.env.TWITTERAPI_IO_BASE_URL;
  const lookupPath = process.env.TWITTERAPI_IO_USER_LOOKUP_PATH;

  if (!apiKey || !baseUrl || !lookupPath) {
    return fallbackProfiles[handle] ?? buildFallbackProfile(handle);
  }

  const url = new URL(lookupPath, baseUrl);
  url.searchParams.set("userName", handle);

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey
    },
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    throw new Error(`twitterapi.io lookup failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const user = payload.data ?? payload.user ?? payload;

  return {
    handle: user.userName ?? user.username ?? user.screen_name ?? handle,
    name: user.name ?? handle,
    bio: user.description ?? user.bio ?? "",
    followers: Number(user.followers ?? user.followers_count ?? user.followersCount ?? 0),
    following: Number(user.following ?? user.friends_count ?? user.followingCount ?? 0),
    location: user.location ?? "Unknown",
    language: user.lang ?? "Unknown",
    verified: Boolean(user.verified ?? user.isBlueVerified ?? user.blue_verified),
    profileImageUrl: user.profilePicture ?? user.profile_image_url_https ?? user.avatar,
    profileUrl: `https://x.com/${user.userName ?? user.username ?? handle}`,
    updatedAt: new Date().toISOString(),
    recentSignal: "Profile details were pulled from the configured twitterapi.io provider."
  };
}

export function profileToInfluencer(profile: TwitterProfile, tags: Niche[], id: number): Influencer {
  return {
    id,
    handle: profile.handle,
    name: profile.name,
    bio: profile.bio,
    followers: profile.followers,
    location: profile.location,
    language: profile.language,
    verified: profile.verified,
    lastActive: "Recently checked",
    updatedAt: profile.updatedAt.slice(0, 10),
    tags,
    confidence: Math.min(96, 72 + tags.length * 4),
    engagement: profile.followers > 100000 ? "High" : profile.followers > 25000 ? "Medium" : "Emerging",
    audience: "Pending admin review",
    recentSignal: profile.recentSignal,
    avatarColor: "#2f6f91",
    profileImageUrl: profile.profileImageUrl,
    profileUrl: profile.profileUrl
  };
}

function buildFallbackProfile(handle: string): TwitterProfile {
  const title = handle
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    handle,
    name: title,
    bio: "Preview profile generated locally. Add TWITTERAPI_IO_API_KEY to fetch real public X data.",
    followers: 0,
    location: "Unknown",
    language: "Unknown",
    verified: false,
    profileUrl: `https://x.com/${handle}`,
    updatedAt: new Date().toISOString(),
    recentSignal: "Mock fallback is active because twitterapi.io credentials are not configured."
  };
}
