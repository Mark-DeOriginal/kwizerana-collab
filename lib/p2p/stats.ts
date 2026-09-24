import { dbQuery, ensureDatabase } from "@/lib/db";

export type P2PStats = {
  totalTrades: number;
  completedTrades: number;
  completionRate30d: number;
  eligibleTrades30d: number;
  volume30d: number;
  volume30dByAsset: Record<string, number>;
  avgReleaseSeconds: number;
  cumulativeCounterparties: number;
  trustScore: number;
  ratingAverage: number | null;
  ratingCount: number;
  advertiserStatus: string;
  advertiserLevel: string;
  verifiedTier: string;
  firstTradeAt: string | null;
  isOnline: boolean;
};

export type SecuritySummary = {
  twoFactorEnabled: boolean;
  antiPhishingSet: boolean;
  hasPassword: boolean;
  emailVerified: boolean;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getP2PStats(userId: string): Promise<P2PStats> {
  await ensureDatabase();
  const queryIds = await getReputationScope(userId);
  const [tradeRows, profileRows, ratingRows] = await Promise.all([
    dbQuery<Record<string, unknown>>(
      `SELECT
         COUNT(*) FILTER (WHERE t.status IN ('released', 'completed') AND t.released_at IS NOT NULL)::INTEGER AS completed_trades,
         COUNT(*) FILTER (
           WHERE COALESCE(t.claimed_at, t.released_at, t.cancelled_at, t.declined_at, t.updated_at) >= NOW() - INTERVAL '30 days'
             AND (t.status IN ('released', 'completed') OR t.declined_at IS NOT NULL OR t.status = 'expired')
         )::INTEGER AS eligible_30d,
         COUNT(*) FILTER (
           WHERE t.status IN ('released', 'completed') AND t.released_at IS NOT NULL
             AND COALESCE(t.claimed_at, t.released_at) >= NOW() - INTERVAL '30 days'
         )::INTEGER AS completed_30d,
         COALESCE(SUM(t.crypto_amount) FILTER (
           WHERE t.status IN ('released', 'completed') AND t.released_at IS NOT NULL
             AND COALESCE(t.claimed_at, t.released_at) >= NOW() - INTERVAL '30 days'
         ), 0)::NUMERIC AS volume_30d,
         COALESCE(SUM(t.crypto_amount) FILTER (
           WHERE t.crypto_currency = 'USDT' AND t.status IN ('released', 'completed') AND t.released_at IS NOT NULL
             AND COALESCE(t.claimed_at, t.released_at) >= NOW() - INTERVAL '30 days'
         ), 0)::NUMERIC AS usdt_30d,
         COALESCE(SUM(t.crypto_amount) FILTER (
           WHERE t.crypto_currency = 'USDC' AND t.status IN ('released', 'completed') AND t.released_at IS NOT NULL
             AND COALESCE(t.claimed_at, t.released_at) >= NOW() - INTERVAL '30 days'
         ), 0)::NUMERIC AS usdc_30d,
         ROUND(AVG(EXTRACT(EPOCH FROM (t.released_at - t.buyer_paid_at))) FILTER (
           WHERE t.released_at IS NOT NULL AND t.buyer_paid_at IS NOT NULL AND t.released_at >= t.buyer_paid_at
         ))::INTEGER AS avg_release_seconds,
         COUNT(DISTINCT CASE
           WHEN t.buyer_id = ANY($1) THEN COALESCE(seller.owner_user_id, seller.id)
           ELSE COALESCE(buyer.owner_user_id, buyer.id)
         END)::INTEGER AS counterparties,
         MIN(t.created_at) FILTER (WHERE t.status IN ('released', 'completed') AND t.released_at IS NOT NULL) AS first_trade_at
       FROM p2p_trades t
       JOIN users buyer ON buyer.id = t.buyer_id
       JOIN users seller ON seller.id = t.seller_id
       WHERE t.buyer_id = ANY($1) OR t.seller_id = ANY($1)`,
      [queryIds]
    ),
    dbQuery<Record<string, unknown>>(
      `SELECT MAX(p2p_advertiser_status) AS p2p_advertiser_status,
              MAX(p2p_advertiser_level) AS p2p_advertiser_level,
              MAX(p2p_verified_tier) AS p2p_verified_tier,
              BOOL_OR(p2p_is_online) AS p2p_is_online
       FROM users WHERE id = ANY($1)`,
      [queryIds]
    ),
    dbQuery<Record<string, unknown>>(
      `SELECT AVG(COALESCE(star_rating, CASE rating WHEN 'positive' THEN 5 WHEN 'neutral' THEN 3 ELSE 1 END))::NUMERIC(4,1) AS rating_average,
              COUNT(*)::INTEGER AS rating_count
       FROM p2p_reviews
       WHERE reviewee_id = ANY($1)`,
      [queryIds]
    )
  ]);
  const trade = tradeRows[0] ?? {};
  const profile = profileRows[0] ?? {};
  const rating = ratingRows[0] ?? {};
  const completedTrades = toNumber(trade.completed_trades);
  const eligible30d = toNumber(trade.eligible_30d);
  const completionRate30d = eligible30d > 0 ? Number(((toNumber(trade.completed_30d) / eligible30d) * 100).toFixed(1)) : 0;
  const ratingAverage = rating.rating_average == null ? null : toNumber(rating.rating_average);
  const ratingCount = toNumber(rating.rating_count);
  const ratingPercent = ratingAverage == null ? 0 : (ratingAverage / 6) * 100;
  const experiencePercent = Math.min(completedTrades / 20, 1) * 100;
  const completionForScore = eligible30d > 0 ? completionRate30d : 100;
  const trustScore = completedTrades === 0
    ? 0
    : Math.round(completionForScore * 0.55 + (ratingCount > 0 ? ratingPercent : 75) * 0.35 + experiencePercent * 0.1);

  return {
    totalTrades: completedTrades,
    completedTrades,
    completionRate30d,
    eligibleTrades30d: eligible30d,
    volume30d: toNumber(trade.volume_30d),
    volume30dByAsset: { USDT: toNumber(trade.usdt_30d), USDC: toNumber(trade.usdc_30d) },
    avgReleaseSeconds: toNumber(trade.avg_release_seconds),
    cumulativeCounterparties: toNumber(trade.counterparties),
    trustScore,
    ratingAverage,
    ratingCount,
    advertiserStatus: String(profile.p2p_advertiser_status ?? "none"),
    advertiserLevel: String(profile.p2p_advertiser_level ?? "none"),
    verifiedTier: String(profile.p2p_verified_tier ?? "none"),
    firstTradeAt: trade.first_trade_at ? String(trade.first_trade_at) : null,
    isOnline: Boolean(profile.p2p_is_online)
  };
}

export async function getReputationScope(userId: string): Promise<string[]> {
  await ensureDatabase();
  const roots = await dbQuery<{ root_id: string }>(
    `SELECT COALESCE(owner_user_id, id)::TEXT AS root_id FROM users WHERE id = $1`,
    [userId]
  );
  const rootId = roots[0]?.root_id ?? userId;
  const rows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM users WHERE id = $1 OR owner_user_id = $1`,
    [rootId]
  );
  return rows.length > 0 ? rows.map((row) => row.id) : [userId];
}

export async function getSecuritySummary(userId: string): Promise<SecuritySummary> {
  await ensureDatabase();
  const rows = await dbQuery<{
    totp_enabled: boolean;
    anti_phishing_code: string;
    password_hash: string | null;
    email_verified: boolean;
  }>(
    `SELECT totp_enabled, anti_phishing_code, password_hash, email_verified FROM users WHERE id = $1`,
    [userId]
  );
  const r = rows[0];

  return {
    twoFactorEnabled: Boolean(r?.totp_enabled),
    antiPhishingSet: Boolean(r?.anti_phishing_code),
    hasPassword: Boolean(r?.password_hash),
    emailVerified: Boolean(r?.email_verified)
  };
}
