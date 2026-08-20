/**
 * Twitter Profile Scraper
 *
 * Scrapes X/Twitter profiles using public page data (no API key needed).
 * Extracts: bio, location, followers, recent tweets.
 * Generates: commentary, tags.
 * Updates DB with tracking via last_scraped_at.
 *
 * Usage:
 *   npx tsx scripts/scrape-profiles.ts            # scrape all unsaved profiles
 *   npx tsx scripts/scrape-profiles.ts --limit 5  # scrape max 5 profiles
 *   npx tsx scripts/scrape-profiles.ts --handle vitalikbuterin  # scrape one profile
 *   npx tsx scripts/scrape-profiles.ts --reset    # reset all scrape tracking
 */

import "dotenv/config";
import { dbQuery, ensureDatabase } from "../lib/db";
import { niches, Niche } from "../lib/influencers";

const BATCH_SIZE = 10;
const DELAY_MS = 2500;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type ScrapeResult = {
  bio: string;
  location: string;
  followers: number;
  following: number;
  tweetCount: number;
  name: string;
  verified: boolean;
  recentTweets: string[];
};

// ─── HTML Parser ──────────────────────────────────────────────

function parseProfileFromHtml(html: string, handle: string): ScrapeResult | null {
  const empty: ScrapeResult = {
    bio: "",
    location: "",
    followers: 0,
    following: 0,
    tweetCount: 0,
    name: "",
    verified: false,
    recentTweets: [],
  };

  // Extract the profile data block from the $R embedded data
  // Pattern: followers:N,following:N,...,location:"...",name:"...",...,screenName:"handle",tweets:N
  const profileRegex = new RegExp(
    "followers:(\\d+),following:(\\d+),isUnavailable:[!1]{2},isVerified:([!1]{2}),location:\"((?:[^\"\\\\]|\\\\.)*)\",name:\"((?:[^\"\\\\]|\\\\.)*)\",possiblySensitive:[!1]{2},profileStatus:\"[^\"]*\",restId:\"\\d+\",screenName:\"" +
      handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "\",tweets:(\\d+)",
    "i"
  );

  const match = html.match(profileRegex);
  if (!match) return null;

  // Extract description (bio) — find it near the profile block
  const profileStart = html.indexOf("followers:" + match[1]);
  const searchChunk = html.substring(
    Math.max(0, profileStart - 2000),
    profileStart + 2000
  );

  let bio = "";
  const descMatch = searchChunk.match(
    /description:"((?:[^"\\]|\\.)*)"/
  );
  if (descMatch) {
    bio = descMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  // Extract recent tweets from the page
  const recentTweets: string[] = [];
  const tweetMatches = Array.from(html.matchAll(/,text:"((?:[^"\\]|\\.)*)",/g));
  for (const tm of tweetMatches) {
    const text = tm[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
    if (text.length > 30 && recentTweets.length < 10) {
      recentTweets.push(text);
    }
  }

  return {
    bio,
    location: match[4] || "",
    followers: parseInt(match[1], 10),
    following: parseInt(match[2], 10),
    tweetCount: parseInt(match[7], 10),
    name: match[5] || "",
    verified: match[3] === "!0",
    recentTweets,
  };
}

async function fetchProfile(handle: string): Promise<ScrapeResult | null> {
  const url = `https://x.com/${handle}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) return null;

  const html = await res.text();
  return parseProfileFromHtml(html, handle);
}

// ─── Commentary & Tag Generator ───────────────────────────────

const NICHE_KEYWORDS: Array<[Niche, string[]]> = [
  ["DeFi", ["defi", "decentralized finance", "lending", "liquidity", "protocol", "amm", "swap", "dex"]],
  ["Yield", ["yield", "vault", "staking", "farm", "apy", "apr", "earn"]],
  ["Stablecoins", ["stablecoin", "usdc", "usdt", "dai", "payments", "remittance"]],
  ["RWA", ["rwa", "tokenized", "real world", "treasury", "credit", "onchain"]],
  ["Protocol Growth", ["growth", "founder", "community", "ecosystem", "builder", "launch"]],
  ["Trading", ["trading", "market", "alpha", "chart", "signals", "portfolio"]],
  ["Ethereum", ["ethereum", "eth", "evm", "solidity", "l2", "rollup", "blob"]],
  ["Bitcoin", ["bitcoin", "btc", "lightning", "ordinals", "brc-20"]],
  ["Security", ["security", "audit", "risk", "oracle", "exploit", "vulnerability"]],
  ["DAO", ["dao", "governance", "delegate", "proposal", "voting"]],
  ["L2", ["layer 2", "l2", "rollup", "optimism", "arbitrum", "base", "zksync"]],
  ["AI x Crypto", ["ai", "agent", "automation", "llm", "gpt", "machine learning"]],
  ["NFTs", ["nft", "nfts", "collectible", "pfp", "digital art", "openSea"]],
  ["Startups", ["startup", "seed", "series a", "pitch", "vc funding", "raise"]],
  ["Venture Capital", ["venture capital", "vc", "investor", "portfolio", "fund"]],
  ["Entrepreneurship", ["entrepreneur", "founder", "ceo", "startup founder", "building"]],
  ["Content Marketing", ["content", "blog", "newsletter", "podcast", "subscribe"]],
  ["Personal Branding", ["personal brand", "branding", "thought leader", "influence"]],
  ["Research", ["research", "academic", "paper", "journal", "study", "analysis"]],
  ["Climate Action", ["climate", "sustainability", "green", "carbon", "emissions"]],
  ["Gaming", ["gaming", "gamer", "esports", "streamer", "play-to-earn", "gamefi"]],
  ["Web Development", ["web dev", "frontend", "backend", "react", "next.js", "typescript"]],
  ["Photography", ["photography", "photographer", "photo", "camera"]],
  ["Journalism", ["journalism", "journalist", "reporter", "press", "news"]],
  ["Music Production", ["music", "producer", "beat", "studio", "audio"]],
];

function generateCommentary(
  name: string,
  handle: string,
  bio: string,
  followers: number,
  recentTweets: string[]
): string {
  const parts: string[] = [];
  const text = `${name} ${bio}`.toLowerCase();

  // Determine tier
  if (followers > 500000) {
    parts.push(`${name} is a major crypto voice with ${formatNum(followers)} followers.`);
  } else if (followers > 100000) {
    parts.push(`${name} is a notable crypto influencer with ${formatNum(followers)} followers.`);
  } else if (followers > 10000) {
    parts.push(`${name} is an active crypto contributor with ${formatNum(followers)} followers.`);
  } else {
    parts.push(`${name} has a growing presence with ${formatNum(followers)} followers.`);
  }

  // Infer focus from bio keywords
  const focus = inferFocus(text);
  if (focus) parts.push(focus);

  // Comment on recent activity if we have tweets
  if (recentTweets.length > 0) {
    const topics = extractTweetTopics(recentTweets);
    if (topics) parts.push(topics);
  }

  return parts.join(" ");
}

function inferFocus(text: string): string {
  if (text.includes("defi") || text.includes("decentralized"))
    return "Focused on decentralized finance and protocol development.";
  if (text.includes("nft") || text.includes("collectible") || text.includes("art"))
    return "Active in the NFT and digital collectibles space.";
  if (text.includes("bitcoin") || text.includes("btc"))
    return "Bitcoin-focused with emphasis on BTC ecosystem.";
  if (text.includes("ethereum") || text.includes("eth") || text.includes("evm"))
    return "Ethereum ecosystem contributor and advocate.";
  if (text.includes("trading") || text.includes("market") || text.includes("alpha"))
    return "Shares trading insights and market analysis.";
  if (text.includes("founder") || text.includes("builder") || text.includes("startup"))
    return "Protocol founder or builder in the crypto space.";
  if (text.includes("venture") || text.includes("vc") || text.includes("investor"))
    return "Venture capital and crypto investment focus.";
  if (text.includes("security") || text.includes("audit"))
    return "Focused on blockchain security and auditing.";
  if (text.includes("education") || text.includes("educator") || text.includes("teach"))
    return "Crypto educator helping others understand the space.";
  if (text.includes("news") || text.includes("journalist") || text.includes("report"))
    return "Crypto journalism and news coverage.";
  if (text.includes("research") || text.includes("analysis"))
    return "Blockchain research and data analysis.";
  return "Active participant in the crypto and Web3 ecosystem.";
}

function extractTweetTopics(tweets: string[]): string {
  const allText = tweets.join(" ").toLowerCase();
  const topics: string[] = [];

  if (allText.includes("eth") || allText.includes("ethereum")) topics.push("Ethereum");
  if (allText.includes("btc") || allText.includes("bitcoin")) topics.push("Bitcoin");
  if (allText.includes("defi")) topics.push("DeFi");
  if (allText.includes("nft")) topics.push("NFTs");
  if (allText.includes("ai") || allText.includes("agent")) topics.push("AI");
  if (allText.includes("l2") || allText.includes("rollup")) topics.push("L2s");
  if (allText.includes("stablecoin") || allText.includes("usdc")) topics.push("Stablecoins");
  if (allText.includes("governance") || allText.includes("dao")) topics.push("Governance");
  if (allText.includes("security") || allText.includes("exploit")) topics.push("Security");

  if (topics.length > 0) {
    return `Recent posts discuss ${topics.slice(0, 4).join(", ")}.`;
  }
  return "";
}

function inferNicheTags(bio: string, name: string, tweets: string[]): Niche[] {
  const text = `${name} ${bio} ${tweets.join(" ")}`.toLowerCase();
  const tags: Niche[] = [];

  for (const [niche, keywords] of NICHE_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.push(niche);
    }
  }

  return tags.slice(0, 5);
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return String(n);
}

// ─── DB Operations ────────────────────────────────────────────

type InfluencerRow = {
  id: number;
  handle: string;
  name: string;
  bio: string;
  followers: number;
  following: number | null;
  location: string;
  language: string;
  verified: boolean;
  last_scraped_at: string | null;
  scrape_notes: string | null;
};

async function getInfluencersToScrape(
  limit: number,
  singleHandle?: string
): Promise<InfluencerRow[]> {
  if (singleHandle) {
    return dbQuery<InfluencerRow>(
      `SELECT * FROM influencers WHERE LOWER(handle) = LOWER($1)`,
      [singleHandle]
    );
  }

  return dbQuery<InfluencerRow>(
    `SELECT * FROM influencers
     WHERE last_scraped_at IS NULL
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  );
}

async function updateInfluencer(
  id: number,
  data: {
    bio: string;
    location: string;
    followers: number;
    following: number;
    commentary: string;
    tags: Niche[];
    notes: string;
  }
): Promise<void> {
  // Update influencer fields
  await dbQuery(
    `UPDATE influencers SET
       bio = $2,
       location = $3,
       followers = $4,
       following = $5,
       commentary = $6,
       last_scraped_at = NOW(),
       scrape_notes = $7,
       updated_at = NOW()
     WHERE id = $1`,
    [id, data.bio, data.location, data.followers, data.following, data.commentary, data.notes]
  );

  // Update niche tags — clear existing, insert new
  await dbQuery(`DELETE FROM influencer_niches WHERE influencer_id = $1`, [id]);

  for (const niche of data.tags) {
    await dbQuery(
      `INSERT INTO influencer_niches (influencer_id, niche) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, niche]
    );
  }
}

async function resetScrapeTracking(): Promise<void> {
  await dbQuery(`UPDATE influencers SET last_scraped_at = NULL, scrape_notes = ''`);
  console.log("Reset all scrape tracking. All influencers marked for re-scrape.");
}

// ─── Main Scraper Loop ────────────────────────────────────────

async function scrapeAll(limit: number, singleHandle?: string) {
  await ensureDatabase();

  const influencers = await getInfluencersToScrape(limit, singleHandle);
  console.log(`Found ${influencers.length} influencer(s) to scrape.\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < influencers.length; i++) {
    const inf = influencers[i];
    const handle = inf.handle;

    console.log(
      `[${i + 1}/${influencers.length}] Scraping @${handle}...`
    );

    try {
      const result = await fetchProfile(handle);

      if (!result) {
        console.log(`  ⚠ No data returned for @${handle} (profile may be protected or deleted)`);
        await dbQuery(
          `UPDATE influencers SET last_scraped_at = NOW(), scrape_notes = $2 WHERE id = $1`,
          [inf.id, "No data returned — profile may be protected or deleted"]
        );
        failCount++;
        await sleep(DELAY_MS);
        continue;
      }

      // Merge: use scraped data if available, otherwise keep DB values
      const bio = result.bio || inf.bio;
      const location = result.location || inf.location;
      const followers = result.followers || inf.followers;
      const following = result.following || inf.following || 0;

      // Generate commentary and tags
      const commentary = generateCommentary(
        inf.name || result.name,
        handle,
        bio,
        followers,
        result.recentTweets
      );
      const tags = inferNicheTags(bio, inf.name || result.name, result.recentTweets);

      const notes = result.recentTweets.length > 0
        ? `Scraped ${result.recentTweets.length} recent tweets. Location: ${location || "Not set"}.`
        : `Scraped profile data. Location: ${location || "Not set"}. No tweet content available.`;

      await updateInfluencer(inf.id, {
        bio,
        location,
        followers,
        following,
        commentary,
        tags,
        notes,
      });

      console.log(`  ✓ Updated: location="${location || "Not set"}" followers=${followers} tweets_analyzed=${result.recentTweets.length}`);
      console.log(`    Commentary: ${commentary.substring(0, 100)}...`);
      console.log(`    Tags: ${tags.join(", ") || "None inferred"}`);
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg}`);
      await dbQuery(
        `UPDATE influencers SET last_scraped_at = NOW(), scrape_notes = $2 WHERE id = $1`,
        [inf.id, `Error: ${msg}`]
      );
      failCount++;
    }

    // Delay between requests to be polite
    if (i < influencers.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n═══ Scraping Complete ═══`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`  Total:   ${influencers.length}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── CLI ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) || 50 : 50;
const handleIdx = args.indexOf("--handle");
const singleHandle = handleIdx !== -1 ? args[handleIdx + 1] : undefined;
const reset = args.includes("--reset");

if (reset) {
  resetScrapeTracking()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  scrapeAll(limit, singleHandle)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
