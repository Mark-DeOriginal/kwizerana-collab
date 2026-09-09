import Image from "next/image";
import Link from "next/link";

const exploreLinks = [
  { href: "/", label: "Crypto voices" },
  { href: "/p2p-marketplace", label: "P2P marketplace" },
  { href: "/p2p-marketplace/trade", label: "Browse offers" },
  { href: "/submit-profile", label: "Submit a profile" }
];

const accountLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/account/payment-methods", label: "Payment methods" },
  { href: "/account/security", label: "Account security" },
  { href: "/auth/sign-in", label: "Sign in" }
];

export function Footer() {
  return (
    <footer className="bg-[#e5e8e4] text-ink">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-12 pb-12 md:grid-cols-[minmax(0,1.8fr)_minmax(10rem,.7fr)_minmax(10rem,.7fr)] lg:pb-16">
          <div className="max-w-lg">
            <Link href="/" className="inline-flex items-center" aria-label="Kwizerana home">
              <Image src="/kwizerana-logo.svg" alt="Kwizerana" width={32} height={32} className="h-8 w-auto" />
            </Link>
            <h2 className="mt-7 max-w-md text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              Crypto context and direct trading, in one place.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#56615a]">
              Discover credible crypto voices and exchange USDT or USDC with other people using familiar payment methods.
            </p>
          </div>

          <FooterLinks title="Explore" links={exploreLinks} />
          <FooterLinks title="Account" links={accountLinks} />
        </div>

        <div className="flex flex-col gap-4 pt-6 text-xs leading-5 text-[#667069] sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Kwizerana. All rights reserved.</p>
          <p>Crypto transactions involve risk. Review every trade before sending funds.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={`${title} links`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667069]">{title}</p>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm font-medium text-[#38443d] transition-colors hover:text-ocean">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
