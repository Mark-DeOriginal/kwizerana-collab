import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Kwizerana Influencer Archive",
  description: "A curated archive for discovering credible X/Twitter voices. Find the right accounts to collaborate with.",
  icons: {
    icon: "/kwizerana-logo-icon.svg"
  },
  openGraph: {
    title: "Kwizerana Influencer Archive",
    description: "A curated archive for discovering credible X/Twitter voices. Find the right accounts to collaborate with.",
    images: ["/opengraph-image.jpg"],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Kwizerana Influencer Archive",
    description: "A curated archive for discovering credible X/Twitter voices. Find the right accounts to collaborate with.",
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
      <body>
        <Providers>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
