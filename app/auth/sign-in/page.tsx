"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowLeft, Check, Database, LogIn, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [googleAuthReady, setGoogleAuthReady] = useState(false);
  const [checkedConfig, setCheckedConfig] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload) => setGoogleAuthReady(Boolean(payload.google)))
      .catch(() => setGoogleAuthReady(false))
      .finally(() => setCheckedConfig(true));
  }, []);

  const isSignedIn = Boolean(session?.user?.email);

  return (
    <main className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="border border-line bg-white/95 p-6 shadow-tight backdrop-blur sm:p-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ocean">
            <ArrowLeft className="h-4 w-4" />
            Back to archive
          </Link>

          <div className="mt-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Kwizerana access</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">Sign up or log in with Google</h1>
            <p className="mt-4 text-base leading-7 text-muted">
              Use one Google account to submit profiles, save lists, and access admin review when your email is approved.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={<ShieldCheck className="h-5 w-5" />} label="Verified identity" />
            <Feature icon={<Database className="h-5 w-5" />} label="Database-ready user records" />
            <Feature icon={<Check className="h-5 w-5" />} label="Role-based admin access" />
          </div>
        </section>

        <aside className="border border-line bg-white/95 p-5 shadow-tight backdrop-blur">
          <div className="border-b border-line pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Account</p>
            <h2 className="mt-1 text-xl font-semibold">{isSignedIn ? "You are signed in" : "Continue securely"}</h2>
          </div>

          {isSignedIn ? (
            <div className="mt-5">
              <div className="border border-line bg-panel p-4">
                <p className="font-semibold">{session?.user?.name ?? "Signed in user"}</p>
                <p className="mt-1 text-sm text-muted">{session?.user?.email}</p>
              </div>
              <Link href="/" className="mt-4 flex h-11 items-center justify-center border border-ink bg-ink px-4 text-sm font-semibold text-white">
                Continue to archive
              </Link>
            </div>
          ) : (
            <div className="mt-5">
              <button
                disabled={!googleAuthReady || status === "loading"}
                onClick={() => void signIn("google", { callbackUrl: "/" })}
                className="flex h-12 w-full items-center justify-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-line disabled:bg-panel disabled:text-muted"
              >
                <LogIn className="h-4 w-4" />
                {status === "loading" ? "Checking session" : "Continue with Google"}
              </button>

              {checkedConfig && !googleAuthReady && (
                <div className="mt-4 border border-coral/40 bg-coral/10 p-4 text-sm leading-6">
                  <p className="font-semibold">Google OAuth is not configured yet.</p>
                  <p className="mt-2 text-muted">
                    Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` to `.env.local`, then restart the dev server.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 border border-line bg-panel p-4 text-sm leading-6 text-muted">
            Signing in creates a user session now. Once the Postgres database is connected, this same flow will persist users,
            roles, submissions, saved lists, and review history.
          </div>
        </aside>
      </div>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-line bg-panel p-3 text-sm font-semibold">
      <span className="grid h-9 w-9 place-items-center bg-mint text-ocean">{icon}</span>
      {label}
    </div>
  );
}
