import NextAuth from "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "admin" | "member";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string | null;
    role?: "admin" | "member";
  }
}
