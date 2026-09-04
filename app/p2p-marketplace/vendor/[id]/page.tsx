"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, Ban, Clock, Loader2, ShieldCheck, Star, Users } from "lucide-react";
import { readJson } from "@/lib/client-request";
import type { P2PStats } from "@/lib/p2p/stats";
import type { PublicReview, RatingSummary } from "@/lib/p2p/reviews";

type VendorProfile = {
  vendor: {
    id: string;
    name: string;
    advertiserStatus: string;
    advertiserLevel: string;
    verifiedTier: string;
    isOnline: boolean;
    memberSince: string;
    activeAds: number;
  };
  stats: P2PStats;
  reviews: PublicReview[];
  ratingSummary: RatingSummary;
  starRating?: { avg: number; count: number } | null;
};

function ratingToStars(rating: string): number {
  if (rating === "positive") return 5;
  if (rating === "neutral") return 3;
  if (rating === "negative") return 1;
  return 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function Stars({ count, size = "h-4 w-4" }: { count: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Star key={i} className={`${size} ${i <= count ? "fill-current text-ocean" : "text-line"}`} />
      ))}
    </span>
  );
}

export default function VendorProfilePage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [error, setError] = useState("");
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/p2p/vendor/${params.id}`, { cache: "no-store" })
      .then((res) => readJson<VendorProfile & { error?: string }>(res))
      .then((data) => {
        if ((data as { error?: string }).error) setError((data as { error?: string }).error!);
        else setProfile(data as VendorProfile);
      })
      .catch(() => setError("Unable to load this vendor."));

    fetch("/api/p2p/social", { cache: "no-store" })
      .then((res) => readJson<{ favorites?: string[] }>(res))
      .then((data) => { if (data?.favorites?.includes(params.id)) setIsFav(true); })
      .catch(() => {});
  }, [params?.id]);

  async function toggle(action: "favorite" | "block") {
    if (action === "favorite") setIsFav((v) => !v);
    await fetch(`/api/p2p/social?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: params.id })
    }).catch(() => {});
  }

  if (error) {
    return (
      <div className="px-4 py-24 text-center text-ink">
        <p className="text-sm text-coral">{error}</p>
        <Link href="/p2p-marketplace/trade" className="mt-4 inline-block text-sm font-semibold text-ocean hover:underline">Back to marketplace</Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center px-4 py-24 text-muted">
        <Loader2 className="h-6 w-6 animate-spin text-ocean" />
      </div>
    );
  }

  const { vendor, stats, reviews, ratingSummary, starRating } = profile;
  const avgStars = starRating ? Math.round(starRating.avg) : 0;

  return (
    <div className="px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/p2p-marketplace/trade" className="text-sm font-semibold text-ocean hover:underline">← Back to marketplace</Link>

        <div className="mt-4 border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-ocean text-xl font-bold text-white">{vendor.name.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{vendor.name}</h1>
                {vendor.isOnline && <span className="flex items-center gap-1 text-xs font-semibold text-moss"><span className="h-2 w-2 rounded-full bg-moss" /> Online</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="flex items-center gap-1"><BadgeCheck className="h-4 w-4 text-moss" /><span className="capitalize">{vendor.advertiserLevel}</span></span>
                {vendor.verifiedTier && vendor.verifiedTier !== "none" && <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-ocean" />{vendor.verifiedTier}</span>}
                <span>Member since {formatDate(vendor.memberSince)}</span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => void toggle("favorite")} className="flex h-9 items-center gap-1.5 border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-ocean">
                <Star className={`h-4 w-4 ${isFav ? "fill-current text-ocean" : ""}`} />
                {isFav ? "Favorited" : "Favorite"}
              </button>
              <button onClick={() => void toggle("block")} className="flex h-9 items-center gap-1.5 border border-line bg-white px-3 text-sm font-semibold text-muted transition-colors hover:border-coral hover:text-coral">
                <Ban className="h-4 w-4" />
                Block
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-line bg-panel px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Trades</p>
              <p className="mt-1 text-lg font-bold">{stats.totalTrades}</p>
            </div>
            <div className="border border-line bg-panel px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Completion</p>
              <p className="mt-1 text-lg font-bold">{stats.completionRate30d}%</p>
            </div>
            <div className="border border-line bg-panel px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">30d volume</p>
              <p className="mt-1 text-lg font-bold">{stats.volume30d.toLocaleString()} USDT</p>
            </div>
            <div className="border border-line bg-panel px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rating</p>
              <p className="mt-1 flex items-center gap-1 text-lg font-bold">{starRating ? `${starRating.avg}/6` : "—"}<Star className="h-4 w-4 fill-current text-ocean" /></p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Stars count={avgStars} />
            <span>{starRating?.count ?? 0} rating{starRating?.count === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="mt-4 border border-line bg-white">
          <p className="border-b border-line px-5 py-3 text-sm font-semibold">Reviews</p>
          {reviews.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">No reviews yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted" /><span className="text-sm font-semibold">{r.reviewer_name}</span></span>
                      <Stars count={ratingToStars(r.rating)} size="h-3.5 w-3.5" />
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted"><Clock className="h-3 w-3" />{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
