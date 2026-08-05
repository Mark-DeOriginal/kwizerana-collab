import { NextResponse } from "next/server";
import { listPublicRankings } from "@/lib/rankings";

export async function GET() {
  const boards = await listPublicRankings();
  return NextResponse.json({ boards });
}
