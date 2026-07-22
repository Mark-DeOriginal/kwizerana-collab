import NextAuth from "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";
import type { Permission } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
      role?: "admin" | "member";
      permissions?: Permission[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string | null;
    role?: "admin" | "member";
    permissions?: Permission[];
  }
}
