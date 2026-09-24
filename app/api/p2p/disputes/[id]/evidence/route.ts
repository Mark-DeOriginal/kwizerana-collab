import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/p2p/server-auth";
import { addDisputeEvidence } from "@/lib/p2p/disputes";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const evidence = await addDisputeEvidence(userId, (await params).id, {
      description: typeof body.description === "string" ? body.description : undefined,
      imageUrl: typeof body.image_url === "string" ? body.image_url : undefined
    });
    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to add evidence." }, { status: 400 });
  }
}
