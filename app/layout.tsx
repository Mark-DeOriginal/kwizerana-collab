import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kwizerana — Crypto voices and P2P markets",
    template: "%s · Kwizerana"
  },
  description: "Discover credible crypto voices and explore self-custody P2P markets with clear, human-centered tools.",
  icons: {
    icon: "/kwizerana-logo-icon.svg"
  },
  openGraph: {
    title: "Kwizerana — Crypto voices and P2P markets",
    description: "Discover credible crypto voices and explore self-custody P2P markets with clear, human-centered tools.",
    images: ["/opengraph-image.jpg"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Kwizerana — Crypto voices and P2P markets",
    description: "Discover credible crypto voices and explore self-custody P2P markets with clear, human-centered tools.",
    images: ["/opengraph-image.jpg"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
