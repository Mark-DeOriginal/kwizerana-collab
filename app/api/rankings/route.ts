import { NextResponse } from "next/server";
import { listPublicRankings } from "@/lib/rankings";

export async function GET() {
  try {
    const boards = await listPublicRankings();
    return NextResponse.json({ boards });
  } catch (error) {
    console.error("GET /api/rankings failed:", error);
    return NextResponse.json({ error: "Unable to load topic leaders right now." }, { status: 503 });
  }
}
