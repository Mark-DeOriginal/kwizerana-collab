"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ChevronDown, FileCheck2, LogIn, LogOut, Plus, ShieldCheck, User } from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";
import { useEffect, useRef, useState } from "react";

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const canReview = canAccessAdminReview(session?.user?.role, session?.user?.permissions);
  const canViewDashboard = canReview;
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/96 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-[1580px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center">
          <Image src="/kwizerana-logo.svg" alt="Kwizerana" width={28} height={28} className="h-7 w-auto shrink-0" />
        </Link>

        <nav className="flex items-center gap-1 text-sm" aria-label="Primary navigation" />

        {/* Desktop nav */}
        <div className="hidden items-center gap-2 md:flex">
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
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                className="flex h-10 items-center gap-2 border border-line px-3 text-xs font-semibold transition-colors hover:bg-panel"
              >
                {session.user.image ? (
                  <Image src={session.user.image} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5 text-muted" />
                )}
                <span className="font-semibold">{session.user.name ?? "Signed in"}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
                    userDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 border border-line bg-white shadow-md">
                  {canReview && (
                    <Link
                      href="/review-profiles"
                      onClick={() => setUserDropdownOpen(false)}
                      className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold transition-colors ${
                        isActive("/review-profiles") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
                      }`}
                    >
                      <FileCheck2 className="h-4 w-4" />
                      Review profiles
                    </Link>
                  )}
                  {canViewDashboard && (
                    <Link
                      href="/admin-dashboard"
                      onClick={() => setUserDropdownOpen(false)}
                      className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold transition-colors ${
                        isActive("/admin-dashboard") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Admin dashboard
                    </Link>
                  )}
                  {(canReview || canViewDashboard) && <div className="border-t border-line" />}
                  <button
                    onClick={() => { setUserDropdownOpen(false); void signOut(); }}
                    className="flex h-10 w-full items-center gap-2 px-4 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
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
          className="relative flex h-10 w-10 items-center justify-center md:hidden"
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
        className={`absolute left-0 right-0 overflow-hidden border-b border-line bg-white shadow-md transition-[max-height] duration-300 ease-in-out md:hidden ${
          menuOpen ? "max-h-80" : "max-h-0 border-b-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 py-3">
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
          {canViewDashboard && (
            <Link
              href="/admin-dashboard"
              onClick={() => setMenuOpen(false)}
              className={`flex h-10 items-center gap-2 px-3 font-semibold transition-colors ${
                isActive("/admin-dashboard") ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin dashboard
            </Link>
          )}
          {session?.user?.email ? (
            <>
              <div className="border-t border-line my-1" />
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                {session.user.image ? (
                  <Image src={session.user.image} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
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
