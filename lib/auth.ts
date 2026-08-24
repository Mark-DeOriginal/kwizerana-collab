import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { ALL_PERMISSIONS, isAdminEmail, resolveUserRole } from "@/lib/roles";
import { getUserByEmail, getUserCredentialsById, markEmailVerified, upsertUser } from "@/lib/users";
import { consumeLoginTicket } from "@/lib/auth/tickets";

export function hasGoogleAuthConfig() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    ...(hasGoogleAuthConfig()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
          })
        ]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        ticket: { label: "Login ticket", type: "text" }
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const ticket = credentials?.ticket;

        if (!email || !ticket) return null;

        const userId = await consumeLoginTicket(ticket);
        if (!userId) return null;

        const user = await getUserCredentialsById(userId);
        if (!user || !user.email_verified) return null;
        if (user.email.toLowerCase() !== email.toLowerCase()) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (user.email) {
        const dbUser = await upsertUser({
          email: user.email,
          name: user.name,
          image: user.image
        });

        if (account?.provider === "google") {
          await markEmailVerified(dbUser.id);
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      try {
        if (user?.email) {
          const dbUser = await upsertUser({
            email: user.email,
            name: user.name,
            image: user.image
          });

          token.userId = dbUser.id;
          token.role = isAdminEmail(user.email) ? "admin" : dbUser.role;
          token.permissions = isAdminEmail(user.email) ? ALL_PERMISSIONS : dbUser.permissions;
        } else if (token.email) {
          const dbUser = await getUserByEmail(token.email);
          token.userId = dbUser?.id ?? null;
          token.role = isAdminEmail(token.email) ? "admin" : (dbUser?.role ?? resolveUserRole(token.email));
          token.permissions = isAdminEmail(token.email) ? ALL_PERMISSIONS : (dbUser?.permissions ?? []);
        }
      } catch (err) {
        console.error("JWT callback DB error, preserving existing token:", err);
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
