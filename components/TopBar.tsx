"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileCheck2, LayoutDashboard, LogIn, LogOut, Menu, Settings, ShieldCheck, User, X } from "lucide-react";
import { canAccessAdminReview } from "@/lib/admin-review-access";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/p2p-marketplace", label: "P2P Marketplace", badge: "New" },
  { href: "/submit-profile", label: "Submit profile" }
];

export function TopBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const canReview = canAccessAdminReview(session?.user?.role, session?.user?.permissions);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
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
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/kwizerana-logo.svg" alt="Kwizerana" width={28} height={28} className="h-7 w-auto shrink-0" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                isActive(item.href) ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
              }`}
            >
              {item.label}
              {item.badge && (
                <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-moss">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {session?.user?.email ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                className="flex h-10 items-center gap-2 rounded-md border border-line px-2.5 text-sm font-semibold transition-colors hover:bg-panel"
              >
                {session.user.image ? (
                  <Image src={session.user.image} alt="" width={22} height={22} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ocean text-white">
                    <User className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="hidden max-w-[140px] truncate sm:inline">{session.user.name ?? "Account"}</span>
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${userDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-md border border-line bg-white shadow-tight">
                  <div className="border-b border-line bg-panel px-4 py-3">
                    <p className="truncate text-sm font-semibold">{session.user.name ?? "Signed in"}</p>
                    <p className="truncate text-xs text-muted">{session.user.email}</p>
                  </div>
                  <div className="p-1">
                    <DropdownLink href="/dashboard" onClick={() => setUserDropdownOpen(false)} active={isActive("/dashboard")} icon={<LayoutDashboard className="h-4 w-4" />}>
                      My dashboard
                    </DropdownLink>
                    <DropdownLink href="/account/security" onClick={() => setUserDropdownOpen(false)} active={isActive("/account")} icon={<Settings className="h-4 w-4" />}>
                      Account settings
                    </DropdownLink>
                    {canReview && (
                      <DropdownLink href="/review-profiles" onClick={() => setUserDropdownOpen(false)} active={isActive("/review-profiles")} icon={<FileCheck2 className="h-4 w-4" />}>
                        Review profiles
                      </DropdownLink>
                    )}
                    {canReview && (
                      <DropdownLink href="/admin-dashboard" onClick={() => setUserDropdownOpen(false)} active={isActive("/admin-dashboard")} icon={<ShieldCheck className="h-4 w-4" />}>
                        Admin dashboard
                      </DropdownLink>
                    )}
                  </div>
                  <div className="border-t border-line p-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        void signOut();
                      }}
                      className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className="hidden h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink sm:flex"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
              <Link
                href="/auth/sign-up"
                className="flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean"
              >
                Get started
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-line bg-white md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
                  isActive(item.href) ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-moss">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}

            <div className="my-2 border-t border-line" />

            {session?.user?.email ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  {session.user.image ? (
                    <Image src={session.user.image} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-ocean text-white">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="font-semibold">{session.user.name ?? "Account"}</span>
                </div>
                <MobileLink href="/dashboard" onClick={() => setMenuOpen(false)}>
                  My dashboard
                </MobileLink>
                <MobileLink href="/account/security" onClick={() => setMenuOpen(false)}>
                  Account settings
                </MobileLink>
                {canReview && (
                  <MobileLink href="/review-profiles" onClick={() => setMenuOpen(false)}>
                    Review profiles
                  </MobileLink>
                )}
                {canReview && (
                  <MobileLink href="/admin-dashboard" onClick={() => setMenuOpen(false)}>
                    Admin dashboard
                  </MobileLink>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-3 pb-2">
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-line text-sm font-semibold transition-colors hover:bg-panel"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center justify-center gap-2 rounded-md bg-ink text-sm font-semibold text-white transition-colors hover:bg-ocean"
                >
                  Get started
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function DropdownLink({
  href,
  onClick,
  active,
  icon,
  children
}: {
  href: string;
  onClick: () => void;
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
        active ? "bg-panel text-ink" : "text-muted hover:bg-panel hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex h-11 items-center rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-panel hover:text-ink"
    >
      {children}
    </Link>
  );
}
