"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { LogIn } from "lucide-react";
import { readJson } from "@/lib/client-request";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [googleAuthReady, setGoogleAuthReady] = useState(false);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [checkedConfig, setCheckedConfig] = useState(false);
  const [configOffline, setConfigOffline] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => readJson<{ google?: boolean; database?: boolean }>(response))
      .then((payload) => {
        if (!payload) {
          setConfigOffline(true);
          return;
        }
        setGoogleAuthReady(Boolean(payload.google));
        setDatabaseReady(Boolean(payload.database));
      })
      .catch(() => {
        setConfigOffline(true);
      })
      .finally(() => setCheckedConfig(true));
  }, []);

  const isSignedIn = Boolean(session?.user?.email);

  return (
    <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Welcome to Kwizerana</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Sign in to Kwizerana Influencer Archive</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Sign in to browse verified X/Twitter profiles, submit accounts for review, and manage your activity on the platform.
          </p>
        </div>

        {isSignedIn ? (
          <div className="mt-8">
            <div className="border border-line bg-panel p-4">
              <p className="font-semibold">{session?.user?.name ?? "Signed-in account"}</p>
              <p className="mt-1 text-sm text-muted">{session?.user?.email}</p>
            </div>
            <Link href="/" className="mt-4 flex h-10 w-fit items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
              Go to archive
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <button
              disabled={!googleAuthReady || status === "loading"}
              onClick={() => void signIn("google", { callbackUrl: "/" })}
              className="flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {status === "loading" ? "Checking session..." : "Continue with Google"}
            </button>

            {checkedConfig && configOffline && (
              <div className="mt-4 border border-coral/40 bg-coral/10 p-4 text-sm leading-6">
                <p className="font-semibold">Couldn&apos;t check sign-in availability.</p>
                <p className="mt-2 text-muted">
                  You appear to be offline. Check your internet connection and try again.
                </p>
              </div>
            )}

            {checkedConfig && !configOffline && !googleAuthReady && (
              <div className="mt-4 border border-coral/40 bg-coral/10 p-4 text-sm leading-6">
                <p className="font-semibold">Google sign-in is not available yet.</p>
                <p className="mt-2 text-muted">
                  Complete the Google authentication setup and restart the application to enable sign-in.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
