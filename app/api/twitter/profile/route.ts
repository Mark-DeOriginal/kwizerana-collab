import { NextResponse } from "next/server";
import { fetchTwitterProfile, TwitterProfileLookupError } from "@/lib/twitter-profile";

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
    if (error instanceof TwitterProfileLookupError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          hint: error.hint,
          providerMessage: error.providerMessage
        },
        { status: error.status }
      );
    }

    return NextResponse.json({ error: "Failed to fetch profile.", code: "UPSTREAM" }, { status: 502 });
  }
}
