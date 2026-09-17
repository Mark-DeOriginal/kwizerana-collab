import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
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
