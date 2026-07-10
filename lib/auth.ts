import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export function hasGoogleAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: hasGoogleAuthConfig()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        })
      ]
    : [],
  callbacks: {
    async session({ session }) {
      if (session.user) {
        session.user.role = isAdminEmail(session.user.email) ? "admin" : "member";
      }
      return session;
    }
  },
  pages: {
    signIn: "/auth/sign-in"
  }
};
