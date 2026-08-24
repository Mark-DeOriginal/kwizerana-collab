"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";

const navItems = [
  { href: "/account/security", label: "Security", icon: ShieldCheck },
  { href: "/account/payment-methods", label: "Payment methods", icon: CreditCard }
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-4 py-10 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Account</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">Settings</h1>

        <nav className="mt-6 flex gap-6 border-b border-line">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
