"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { FileCheck2, LogIn, LogOut, Plus, User } from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const canReview = canAccessAdminReview(session?.user?.role);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/96 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1580px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="grid h-9 w-9 shrink-0 place-items-center bg-ink text-xs font-bold text-white">KW</div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Kwizerana</p>
            <p className="text-sm font-semibold leading-tight">Influencer Archive</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1 text-sm" aria-label="Primary navigation" />

        <div className="flex items-center gap-2">
          {canReview && (
            <Link
              href="/review-profiles"
              className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
                isActive("/review-profiles") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Review profile</span>
            </Link>
          )}
          <Link
            href="/submit-profile"
            className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
              isActive("/submit-profile") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Submit profile</span>
          </Link>
          {status === "loading" ? (
            <div className="h-10 w-10 animate-pulse rounded bg-panel" />
          ) : session?.user?.email ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 border border-line px-3 py-1.5 text-xs md:flex">
                <User className="h-3.5 w-3.5 text-muted" />
                <span className="font-semibold">{session.user.name ?? "Signed in"}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex h-10 items-center gap-2 px-3 font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/auth/sign-in"
              className="flex h-10 items-center gap-2 bg-ink px-4 font-semibold text-white transition-colors hover:bg-ocean"
            >
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
