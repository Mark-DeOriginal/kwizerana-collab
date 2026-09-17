import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retained as an explicit compatibility response for clients from an older
 * deployment. Live updates now use one visibility-aware browser poll instead
 * of a serverless SSE connection that created its own nested polling loop.
 */
export async function GET() {
  return NextResponse.json(
    { error: "The legacy update stream has been retired. Refresh the application." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
