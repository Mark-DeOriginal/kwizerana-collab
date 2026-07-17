"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { FileCheck2, LogIn, LogOut, Plus, User } from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { useRef, useState } from "react";

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const canReview = canAccessAdminReview(session?.user?.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 sm:flex">
          {canReview && (
            <Link
              href="/review-profiles"
              className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
                isActive("/review-profiles") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Review profiles</span>
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
          {session?.user?.email ? (
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
              <span>Sign in</span>
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="relative flex h-10 w-10 items-center justify-center sm:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`absolute h-0.5 w-5 bg-ink transition-all duration-300 ease-in-out ${
              menuOpen ? "rotate-45" : "-translate-y-1.5"
            }`}
          />
          <span
            className={`absolute h-0.5 w-5 bg-ink transition-all duration-300 ease-in-out ${
              menuOpen ? "scale-0" : ""
            }`}
          />
          <span
            className={`absolute h-0.5 w-5 bg-ink transition-all duration-300 ease-in-out ${
              menuOpen ? "-rotate-45" : "translate-y-1.5"
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <div
        ref={menuRef}
        className={`absolute left-0 right-0 overflow-hidden border-b border-line bg-white shadow-md transition-[max-height] duration-300 ease-in-out sm:hidden ${
          menuOpen ? "max-h-64" : "max-h-0 border-b-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
          {canReview && (
            <Link
              href="/review-profiles"
              onClick={() => setMenuOpen(false)}
              className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
                isActive("/review-profiles") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              Review profiles
            </Link>
          )}
          <Link
            href="/submit-profile"
            onClick={() => setMenuOpen(false)}
            className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
              isActive("/submit-profile") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
            }`}
          >
            <Plus className="h-4 w-4" />
            Submit profile
          </Link>
          {session?.user?.email ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                <User className="h-3.5 w-3.5" />
                <span className="font-semibold">{session.user.name ?? "Signed in"}</span>
              </div>
              <button
                onClick={() => { setMenuOpen(false); void signOut(); }}
                className="flex h-10 items-center gap-2 px-3 font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              onClick={() => setMenuOpen(false)}
              className="flex h-10 items-center gap-2 bg-ink px-4 font-semibold text-white transition-colors hover:bg-ocean"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
