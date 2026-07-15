import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import { SiteShell } from "@/components/SiteShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kwizerana Influencer Archive",
  description: "A curated archive for discovering credible X/Twitter voices. Find the right accounts to collaborate with."
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
