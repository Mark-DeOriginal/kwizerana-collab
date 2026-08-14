import { NextResponse } from "next/server";
import { listArchive, listInfluencersByIds, type Niche } from "@/lib/influencers";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (ids.length > 0) {
      const influencers = await listInfluencersByIds(ids);
      return NextResponse.json({
        data: {
          influencers,
          pagination: { page: 1, limit: ids.length, total: influencers.length, totalPages: 1 },
          stats: { totalInfluencers: influencers.length, pendingSubmissions: 0, totalUsers: 0, avgConfidence: 0 }
        }
      });
    }

    const isExport = url.searchParams.get("export") === "1" || url.searchParams.get("export") === "true";
    const page = isExport ? 1 : parsePositiveInt(url.searchParams.get("page"), 1);
    const limit = isExport ? 100000 : Math.min(200, parsePositiveInt(url.searchParams.get("limit"), 30));
    const query = url.searchParams.get("q")?.trim() || undefined;
    const minFollowers = parsePositiveInt(url.searchParams.get("minFollowers"), 0);
    const verifiedOnly = url.searchParams.get("verifiedOnly") === "1" || url.searchParams.get("verifiedOnly") === "true";
    const niches = (url.searchParams.get("niches") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean) as Niche[];
    const sortBy = url.searchParams.get("sort") === "followers" ? "followers" : "match";

    const result = await listArchive({ query, minFollowers, verifiedOnly, niches, sortBy, page, limit });

    return NextResponse.json({
      data: {
        influencers: result.influencers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        stats: { totalInfluencers: result.total, pendingSubmissions: 0, totalUsers: 0, avgConfidence: 0 }
      }
    });
  } catch (error) {
    console.error("GET /api/archive failed:", error);
    return NextResponse.json(
      { error: "Unable to load profiles. Please check your internet connection and try again." },
      { status: 500 }
    );
  }
}
