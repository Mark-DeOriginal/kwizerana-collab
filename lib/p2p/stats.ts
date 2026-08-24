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
  const rows = await dbQuery<Record<string, unknown>>(
    `SELECT p2p_total_trades, p2p_completed_trades, p2p_completion_rate_30d, p2p_volume_30d,
            p2p_avg_release_seconds, p2p_cumulative_counterparties, p2p_trust_score,
            p2p_advertiser_status, p2p_advertiser_level, p2p_verified_tier,
            p2p_first_trade_at, p2p_is_online
     FROM users WHERE id = $1`,
    [userId]
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
