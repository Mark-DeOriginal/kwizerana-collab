import { NextResponse } from "next/server";
import { hasGoogleAuthConfig } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  return NextResponse.json({
    google: hasGoogleAuthConfig(),
    database: isDatabaseConfigured()
  });
}
