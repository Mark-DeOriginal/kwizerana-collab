import Link from "next/link";
import { Database, Plus } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-[1580px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-24">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center bg-ink text-[10px] font-bold text-white">KW</div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Kwizerana</p>
                <p className="text-sm font-semibold leading-tight">Influencer Archive</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              A curated archive for discovering credible X/Twitter voices. Find the right accounts to collaborate with.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Navigate</p>
            <div className="mt-3 flex flex-col gap-2 text-sm font-semibold text-muted">
              <Link href="/" className="flex items-center gap-2 transition-colors hover:text-ink">
                <Database className="h-3.5 w-3.5" />
                Archive
              </Link>
              <Link href="/submit-profile" className="flex items-center gap-2 transition-colors hover:text-ink">
                <Plus className="h-3.5 w-3.5" />
                Submit profile
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-4">
          <p className="text-xs text-muted">&copy; {new Date().getFullYear()} Kwizerana. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
