import { NextResponse } from "next/server";
import { fetchTwitterProfile } from "@/lib/twitter-profile";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const profile = searchParams.get("profile");

  if (!profile) {
    return NextResponse.json({ error: "Missing profile query parameter." }, { status: 400 });
  }

  try {
    const data = await fetchTwitterProfile(profile);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch profile." }, { status: 400 });
  }
}
