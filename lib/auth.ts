import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveUserRole } from "@/lib/roles";
import { getUserByEmail, upsertUser } from "@/lib/users";

export function hasGoogleAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: hasGoogleAuthConfig()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        })
      ]
    : [],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await upsertUser({
          email: user.email,
          name: user.name,
          image: user.image
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await upsertUser({
          email: user.email,
          name: user.name,
          image: user.image
        });

        token.userId = dbUser.id;
        token.role = dbUser.role;
      } else if (token.email) {
        const dbUser = await getUserByEmail(token.email);
        token.userId = dbUser?.id ?? null;
        token.role = dbUser?.role ?? resolveUserRole(token.email);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : undefined;
        session.user.role = token.role === "admin" ? "admin" : "member";
      }

      return session;
    }
  },
  pages: {
    signIn: "/auth/sign-in"
  }
};
