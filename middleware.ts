import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const destination = new URL("/redirect", request.url);
  destination.searchParams.set("next", returnTo);
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin-dashboard/:path*",
    "/dashboard/:path*",
    "/notifications/:path*",
    "/p2p/ads/:path*",
    "/p2p/disputes/:path*",
    "/p2p-marketplace/trade/:path*",
    "/review-profiles/:path*",
    "/submit-profile/:path*"
  ]
};
