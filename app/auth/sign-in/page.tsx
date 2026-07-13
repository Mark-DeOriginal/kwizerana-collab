"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { ArrowLeft, Check, Database, LogIn, ShieldCheck } from "lucide-react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [googleAuthReady, setGoogleAuthReady] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [checkedConfig, setCheckedConfig] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload) => {
        setGoogleAuthReady(Boolean(payload.google));
        setDatabaseReady(Boolean(payload.database));
      })
      .catch(() => {
        setGoogleAuthReady(false);
        setDatabaseReady(false);
      })
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Welcome to Kwizerana</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">Sign up or log in with Google</h1>
            <p className="mt-4 text-base leading-7 text-muted">
              Sign in with your Google account to explore the archive, submit profiles for review, and access additional tools.
            </p>
          </div>

          {/* <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Feature icon={<ShieldCheck className="h-5 w-5" />} label="Trusted sign-in" />
            <Feature icon={<Database className="h-5 w-5" />} label="Secure account access" />
            <Feature icon={<Check className="h-5 w-5" />} label="Admin permissions" />
          </div> */}
        </section>

        <aside className="border border-line bg-white/95 p-5 shadow-tight backdrop-blur">
          <div className="border-b border-line pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Account Access</p>
            <h2 className="mt-1 text-xl font-semibold">{isSignedIn ? "You're signed in" : "Continue with Google"}</h2>
          </div>

          {isSignedIn ? (
            <div className="mt-5">
              <div className="border border-line bg-panel p-4">
                <p className="font-semibold">{session?.user?.name ?? "Signed-in account"}</p>
                <p className="mt-1 text-sm text-muted">{session?.user?.email}</p>
              </div>
              <Link href="/" className="mt-4 flex h-11 items-center justify-center border border-ink bg-ink px-4 text-sm font-semibold text-white">
                Go to archive
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
                  <p className="font-semibold">Google sign-in is not available yet.</p>
                  <p className="mt-2 text-muted">
                    Complete the Google authentication setup and restart the application to enable sign-in.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 border border-line bg-panel p-4 text-sm leading-6 text-muted">
            {databaseReady
              ? "Continue with your Google account to access the archive, submit profiles for review, and manage your activity securely."
              : "Complete the application setup to enable secure sign-in, profile submissions, and account access."}
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
