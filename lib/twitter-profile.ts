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

type TwitterApiPayload = Record<string, unknown>;

export type TwitterLookupErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "UPSTREAM"
  | "MISCONFIGURED";

export class TwitterProfileLookupError extends Error {
  code: TwitterLookupErrorCode;
  status: number;
  hint?: string;
  providerMessage?: string;

  constructor(input: {
    message: string;
    code: TwitterLookupErrorCode;
    status: number;
    hint?: string;
    providerMessage?: string;
  }) {
    super(input.message);
    this.name = "TwitterProfileLookupError";
    this.code = input.code;
    this.status = input.status;
    this.hint = input.hint;
    this.providerMessage = input.providerMessage;
  }
}

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
    ["AI x Crypto", ["ai", "agent", "automation"]],
    ["NFTs", ["nft", "nfts", "collectible", "digital art"]],
    ["Web Development", ["web dev", "frontend", "backend", "fullstack", "react", "next.js", "node.js", "javascript", "typescript", "html", "css"]],
    ["Mobile Development", ["mobile dev", "ios", "android", "react native", "flutter", "swift", "kotlin"]],
    ["AI / Machine Learning", ["machine learning", "deep learning", "neural", "gpt", "llm", "nlp", "computer vision", "tensorflow", "pytorch"]],
    ["Data Science", ["data science", "data analyst", "analytics", "visualization", "pandas", "sql"]],
    ["DevOps", ["devops", "ci/cd", "docker", "kubernetes", "terraform", "infrastructure"]],
    ["Cloud Computing", ["cloud", "aws", "azure", "gcp", "serverless"]],
    ["Cybersecurity", ["cybersecurity", "infosec", "penetration", "hacking", "vulnerability"]],
    ["Game Development", ["game dev", "unity", "unreal", "gamedev"]],
    ["UI/UX Design", ["ui/ux", "ux design", "user experience", "figma", "wireframe", "prototype"]],
    ["Graphic Design", ["graphic design", "logo", "photoshop", "illustrator"]],
    ["Photography", ["photography", "photographer", "photo", "camera", "portrait"]],
    ["Videography", ["videography", "videographer", "video production", "cinematography"]],
    ["Entrepreneurship", ["entrepreneur", "founder", "ceo", "startup founder", "business owner"]],
    ["Startups", ["startup", "seed", "series a", "pitch", "vc funding"]],
    ["E-commerce", ["ecommerce", "e-commerce", "shopify", "dropshipping", "store"]],
    ["SEO", ["seo", "search engine", "keywords", "backlink"]],
    ["Content Marketing", ["content marketing", "blog", "content strategy", "editorial"]],
    ["Social Media Marketing", ["social media", "instagram", "tiktok", "growth hacking"]],
    ["Copywriting", ["copywriter", "copywriting", "sales page", "landing page", "copy"]],
    ["Personal Branding", ["personal brand", "branding", "thought leader"]],
    ["Stock Market", ["stocks", "stock market", "equities", "wall street", "s&p", "nasdaq"]],
    ["Personal Finance", ["personal finance", "budgeting", "saving", "money management"]],
    ["Real Estate", ["real estate", "property", "mortgage", "realtor"]],
    ["Accounting", ["accounting", "accountant", "bookkeeping", "cpa"]],
    ["Venture Capital", ["venture capital", "vc", "investor", "portfolio"]],
    ["Physics", ["physics", "quantum", "thermodynamics", "particle"]],
    ["Biology", ["biology", "genetics", "biotech", "molecular"]],
    ["Chemistry", ["chemistry", "chemist", "organic", "synthesis"]],
    ["Mathematics", ["mathematics", "math", "algebra", "calculus", "statistics"]],
    ["Astronomy", ["astronomy", "astrophysics", "space", "telescope"]],
    ["Research", ["research", "academic", "paper", "journal", "study"]],
    ["Online Education", ["education", "online course", "e-learning", "teaching", "tutor"]],
    ["Farming", ["farming", "agriculture", "crop", "harvest", "agri"]],
    ["Climate Action", ["climate", "sustainability", "green", "carbon", "emissions"]],
    ["Renewable Energy", ["renewable", "solar", "wind energy", "clean energy"]],
    ["Cooking", ["cooking", "chef", "recipe", "culinary", "food"]],
    ["Baking", ["baking", "bakery", "bread", "pastry", "cake"]],
    ["Nutrition", ["nutrition", "dietitian", "diet", "health food", "supplements"]],
    ["Fitness", ["fitness", "gym", "workout", "exercise", "personal trainer"]],
    ["Mental Health", ["mental health", "therapy", "psychology", "therapist", "counseling"]],
    ["Self-Improvement", ["self-improvement", "self-help", "mindset", "growth mindset", "habits"]],
    ["Productivity", ["productivity", "time management", "getting things done", "gtd"]],
    ["Biohacking", ["biohacking", "nootropics", "longevity", "optimization"]],
    ["Podcasting", ["podcast", "podcaster", "audio", "episode"]],
    ["Journalism", ["journalism", "journalist", "reporter", "press", "news"]],
    ["Music Production", ["music production", "producer", "beat", "studio", "audio engineering"]],
    ["Film", ["film", "filmmaker", "director", "screenplay", "movie"]],
    ["Virtual Assistance", ["virtual assistant", "va", "remote assistant", "admin support"]],
    ["Freelancing", ["freelance", "freelancer", "self-employed", "contractor"]],
    ["Career Development", ["career", "resume", "job search", "interview", "hiring"]],
    ["Legal", ["legal", "lawyer", "attorney", "law", "litigation"]],
    ["Recruiting", ["recruiting", "recruiter", "talent acquisition", "headhunter"]],
    ["Remote Work", ["remote work", "distributed", "work from home", "wfh", "digital nomad"]],
    ["Travel", ["travel", "wanderlust", "explorer", "backpacking", "journey"]],
    ["Fashion", ["fashion", "style", "designer", "clothing", "outfit"]],
    ["Gaming", ["gaming", "gamer", "esports", "streamer", "twitch"]],
    ["Politics", ["politics", "political", "policy", "government", "election"]],
    ["Comedy", ["comedy", "comedian", "humor", "funny", "jokes"]],
    ["Community Building", ["community", "community manager", "building community"]],
    ["Science Communication", ["science comm", "science writer", "science communication"]],
    ["Activism", ["activist", "activism", "protest", "advocacy", "social change"]],
  ];

  checks.forEach(([niche, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) inferred.add(niche);
  });

  return Array.from(inferred).slice(0, 5);
}

function normalizeLookupUrl(baseUrl: string, lookupPath: string, handle: string) {
  const trimmedBaseUrl = baseUrl.trim();
  const trimmedPath = lookupPath.trim();

  const normalizedBaseUrl = (() => {
    const url = new URL(trimmedBaseUrl);

    // Accept `twitterapi.io` in env config but normalize to the documented API host.
    if (url.hostname === "twitterapi.io") {
      url.hostname = "api.twitterapi.io";
    }

    return url.toString();
  })();

  const rawUrl = /^https?:\/\//i.test(trimmedPath) ? trimmedPath : new URL(trimmedPath, normalizedBaseUrl).toString();
  const url = new URL(rawUrl);

  if (url.hostname === "twitterapi.io") {
    url.hostname = "api.twitterapi.io";
  }

  url.searchParams.set("userName", handle);
  return url;
}

function pickUser(payload: TwitterApiPayload): TwitterApiPayload | null {
  const candidates = [
    payload.data,
    payload.user,
    payload.result,
    payload.profile,
    payload.data && typeof payload.data === "object" ? (payload.data as TwitterApiPayload).user : null,
    payload.data && typeof payload.data === "object" ? (payload.data as TwitterApiPayload).result : null,
    payload.data && typeof payload.data === "object" ? (payload.data as TwitterApiPayload).profile : null
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as TwitterApiPayload;
    }
  }

  return payload;
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function booleanFrom(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
  }

  return false;
}

function buildTwitterApiError(status: number, body: string) {
  const normalized = body.toLowerCase();

  if (status === 404 || normalized.includes("not found") || normalized.includes("user not found")) {
    return new TwitterProfileLookupError({
      message: "We couldn't find that X profile. Check the handle or profile link and try again.",
      code: "NOT_FOUND",
      status: 404,
      hint: "If the handle is correct, the provider may not have returned the profile yet.",
      providerMessage: body || undefined
    });
  }

  if (status === 401 || status === 403) {
    return new TwitterProfileLookupError({
      message: "twitterapi.io rejected the request.",
      code: "AUTH",
      status,
      hint: "Recheck your API key, endpoint settings, or account permissions on the current plan.",
      providerMessage: body || undefined
    });
  }

  if (status === 429 || normalized.includes("rate limit")) {
    return new TwitterProfileLookupError({
      message: "twitterapi.io rate limited the request.",
      code: "RATE_LIMIT",
      status: 429,
      hint: "This can happen when the plan limit is reached or too many requests are sent in a short time.",
      providerMessage: body || undefined
    });
  }

  if (status >= 500) {
    return new TwitterProfileLookupError({
      message: "twitterapi.io is temporarily unavailable.",
      code: "UPSTREAM",
      status,
      hint: "The provider appears to be having trouble right now. Please try again shortly.",
      providerMessage: body || undefined
    });
  }

  return new TwitterProfileLookupError({
    message: `twitterapi.io lookup failed with status ${status}.`,
    code: "UPSTREAM",
    status,
    hint: "The provider responded unexpectedly. Please verify the endpoint and plan access.",
    providerMessage: body || undefined
  });
}

export async function fetchTwitterProfile(input: string): Promise<TwitterProfile> {
  const handle = extractTwitterHandle(input);
  if (!handle) {
    throw new TwitterProfileLookupError({
      message: "Enter a valid X/Twitter profile link or handle.",
      code: "INVALID_INPUT",
      status: 400
    });
  }

  const apiKey = process.env.TWITTERAPI_IO_API_KEY;
  const baseUrl = process.env.TWITTERAPI_IO_BASE_URL;
  const lookupPath = process.env.TWITTERAPI_IO_USER_LOOKUP_PATH;

  if (!apiKey || !baseUrl || !lookupPath) {
    return fallbackProfiles[handle] ?? buildFallbackProfile(handle);
  }
  try {
    const url = normalizeLookupUrl(baseUrl, lookupPath, handle);
    const response = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw buildTwitterApiError(response.status, errorBody);
    }

    const payload = (await response.json()) as TwitterApiPayload;
    const user = pickUser(payload);

    if (!user) {
      throw new TwitterProfileLookupError({
        message: "twitterapi.io returned an unexpected response shape.",
        code: "UPSTREAM",
        status: 502,
        hint: "The provider responded, but not in the format this app expected."
      });
    }

    const resolvedHandle = stringFrom(user.userName, user.username, user.screen_name, handle) || handle;

    return {
      handle: resolvedHandle,
      name: stringFrom(user.name, user.displayName, resolvedHandle) || resolvedHandle,
      bio: stringFrom(user.description, user.bio),
      followers: numberFrom(user.followers, user.followers_count, user.followersCount),
      following: numberFrom(user.following, user.friends_count, user.followingCount) || undefined,
      location: stringFrom(user.location) || "Unknown",
      language: stringFrom(user.lang, user.language) || "English",
      verified: booleanFrom(user.verified, user.isBlueVerified, user.blue_verified),
      profileImageUrl: stringFrom(user.profilePicture, user.profile_image_url_https, user.avatar) || undefined,
      profileUrl: `https://x.com/${resolvedHandle}`,
      updatedAt: new Date().toISOString(),
      recentSignal: ""
    };
  } catch (error) {
    if (error instanceof TwitterProfileLookupError) {
      throw error;
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      throw new TwitterProfileLookupError({
        message: "twitterapi.io took too long to respond.",
        code: "TIMEOUT",
        status: 504,
        hint: "The provider may be slow right now. Please try again."
      });
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new TwitterProfileLookupError({
        message: "twitterapi.io request was interrupted.",
        code: "TIMEOUT",
        status: 504,
        hint: "The request timed out before the provider responded. Please try again."
      });
    }

    throw new TwitterProfileLookupError({
      message: "We couldn't reach twitterapi.io right now.",
      code: "UPSTREAM",
      status: 502,
      hint: "Please verify the provider settings and try again."
    });
  }
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
    language: "English",
    verified: false,
    profileUrl: `https://x.com/${handle}`,
    updatedAt: new Date().toISOString(),
    recentSignal: "Mock fallback is active because twitterapi.io credentials are not configured."
  };
}
