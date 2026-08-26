import { dbQuery, ensureDatabase } from "@/lib/db";

export type P2PStats = {
  totalTrades: number;
  completedTrades: number;
  completionRate30d: number;
  volume30d: number;
  avgReleaseSeconds: number;
  cumulativeCounterparties: number;
  trustScore: number;
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

  // Check if user owns any vendor accounts (e.g. Kwizerana DAO)
  const ownedRows = await dbQuery<{ id: string }>(
    `SELECT id::TEXT AS id FROM users WHERE owner_user_id = $1`,
    [userId]
  );
  const ownedIds = ownedRows.map((r) => r.id);
  const queryIds = [userId, ...ownedIds];

  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT SUM(p2p_total_trades)::NUMERIC AS p2p_total_trades,
            SUM(p2p_completed_trades)::NUMERIC AS p2p_completed_trades,
            ROUND(SUM(p2p_completed_trades)::NUMERIC / NULLIF(SUM(p2p_total_trades), 0) * 100, 1) AS p2p_completion_rate_30d,
            SUM(p2p_volume_30d)::NUMERIC AS p2p_volume_30d,
            ROUND(AVG(p2p_avg_release_seconds))::INTEGER AS p2p_avg_release_seconds,
            SUM(p2p_cumulative_counterparties)::NUMERIC AS p2p_cumulative_counterparties,
            MAX(p2p_trust_score)::INTEGER AS p2p_trust_score,
            MAX(p2p_advertiser_status) AS p2p_advertiser_status,
            MAX(p2p_advertiser_level) AS p2p_advertiser_level,
            MAX(p2p_verified_tier) AS p2p_verified_tier,
            MIN(p2p_first_trade_at) AS p2p_first_trade_at,
            BOOL_OR(p2p_is_online) AS p2p_is_online
     FROM users WHERE id = ANY($1)`,
    [queryIds]
  );
  const r = rows[0] ?? {};

  return {
    totalTrades: toNumber(r.p2p_total_trades),
    completedTrades: toNumber(r.p2p_completed_trades),
    completionRate30d: toNumber(r.p2p_completion_rate_30d),
    volume30d: toNumber(r.p2p_volume_30d),
    avgReleaseSeconds: toNumber(r.p2p_avg_release_seconds),
    cumulativeCounterparties: toNumber(r.p2p_cumulative_counterparties),
    trustScore: toNumber(r.p2p_trust_score),
    advertiserStatus: String(r.p2p_advertiser_status ?? "none"),
    advertiserLevel: String(r.p2p_advertiser_level ?? "none"),
    verifiedTier: String(r.p2p_verified_tier ?? "none"),
    firstTradeAt: r.p2p_first_trade_at ? String(r.p2p_first_trade_at) : null,
    isOnline: Boolean(r.p2p_is_online)
  };
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
