import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { niches, Niche } from "@/lib/influencers";
import { createSubmission, listSubmissions } from "@/lib/submissions";

export async function GET() {
  return NextResponse.json({ data: listSubmissions() });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();
  const selectedNiches = Array.isArray(body.niches) ? body.niches.filter((item: Niche) => niches.includes(item)) : [];

  if (!body.profileUrl || selectedNiches.length === 0) {
    return NextResponse.json({ error: "Profile link and at least one niche are required." }, { status: 400 });
  }

  const submission = await createSubmission({
    profileUrl: String(body.profileUrl),
    niches: selectedNiches,
    submitterEmail: session?.user?.email ?? String(body.email ?? "anonymous@local.test"),
    note: String(body.note ?? "")
  });

  return NextResponse.json({ data: submission }, { status: 201 });
}
