import { NextResponse } from "next/server";
import { getArchiveStats, listInfluencers } from "@/lib/influencers";

export async function GET() {
  try {
    const [influencers, stats] = await Promise.all([listInfluencers(), getArchiveStats()]);
    return NextResponse.json({ data: { influencers, stats } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load archive data." },
      { status: 500 }
    );
  }
}
