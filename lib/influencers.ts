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

export const influencers: Influencer[] = [
  {
    id: 1,
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
    saved: true
  },
  {
    id: 2,
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
    avatarColor: "#d76b55"
  },
  {
    id: 3,
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
    avatarColor: "#e9b44c"
  },
  {
    id: 4,
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
    avatarColor: "#5a4b7f"
  },
  {
    id: 5,
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
    avatarColor: "#506b43"
  },
  {
    id: 6,
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
    avatarColor: "#182026"
  },
  {
    id: 7,
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
    avatarColor: "#2f6f91"
  },
  {
    id: 8,
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
    avatarColor: "#d76b55"
  }
];
