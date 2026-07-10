import { NextResponse } from "next/server";
import { hasGoogleAuthConfig } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    google: hasGoogleAuthConfig()
  });
}
