import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { dbQuery } from "@/lib/db";
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
        token.permissions = dbUser.permissions;
      } else if (token.email) {
        const dbUser = await getUserByEmail(token.email);
        token.userId = dbUser?.id ?? null;
        token.role = dbUser?.role ?? resolveUserRole(token.email);
        token.permissions = dbUser?.permissions ?? [];

        await dbQuery(
          `UPDATE users SET last_sign_in_at = NOW() WHERE email = $1`,
          [token.email.toLowerCase()]
        );
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : undefined;
        session.user.role = token.role === "admin" ? "admin" : "member";
        session.user.permissions = token.permissions ?? [];
      }

      return session;
    }
  },
  pages: {
    signIn: "/auth/sign-in"
  }
};
