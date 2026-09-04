import { NextResponse } from "next/server";
import { dbQuery, ensureDatabase } from "@/lib/db";
import { getP2PStats } from "@/lib/p2p/stats";
import { listReviewsForUser, getRatingSummary, getVendorAverageStars } from "@/lib/p2p/reviews";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  await ensureDatabase();

  const rows = await dbQuery<{
    id: string;
    name: string;
    advertiser_status: string;
    advertiser_level: string;
    verified_tier: string;
    is_online: boolean;
    created_at: string;
  }>(
    `SELECT id, name, p2p_advertiser_status AS advertiser_status,
            p2p_advertiser_level AS advertiser_level, p2p_verified_tier AS verified_tier,
            p2p_is_online AS is_online, created_at
     FROM users WHERE id = $1 AND p2p_advertiser_status <> 'none'`,
    [params.id]
  );
  const vendor = rows[0];
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  }

  const adRows = await dbQuery<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM p2p_ads WHERE user_id = $1 AND status = 'active' AND is_paused = FALSE`,
    [params.id]
  );

  const [stats, reviews, ratingSummary, starRating] = await Promise.all([
    getP2PStats(params.id),
    listReviewsForUser(params.id),
    getRatingSummary(params.id),
    getVendorAverageStars(params.id)
  ]);

  return NextResponse.json({
    vendor: {
      id: vendor.id,
      name: vendor.name,
      advertiserStatus: vendor.advertiser_status,
      advertiserLevel: vendor.advertiser_level,
      verifiedTier: vendor.verified_tier,
      isOnline: Boolean(vendor.is_online),
      memberSince: vendor.created_at,
      activeAds: Number(adRows[0]?.count ?? "0")
    },
    stats,
    reviews,
    ratingSummary,
    starRating
  });
}
