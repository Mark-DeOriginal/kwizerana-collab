"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowLeft, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { readJson } from "@/lib/client-request";

type Config = { google?: boolean; database?: boolean };
type LoginStep = "credentials" | "twoFactor";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [config, setConfig] = useState<Config>({});
  const [checkedConfig, setCheckedConfig] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailUnverified, setEmailUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => readJson<Config>(response))
      .then((payload) => {
        if (payload) {
          setConfig(payload);
        }
      })
      .finally(() => setCheckedConfig(true));
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      router.replace("/");
    }
  }, [session, router]);

  async function completeLogin(loginEmail: string, ticket: string) {
    const result = await signIn("credentials", { email: loginEmail, ticket, redirect: false });
    if (result?.error) {
      setError("Unable to sign in. Please try again.");
      setStep("credentials");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEmailUnverified(false);
    setLoading(true);

    const res = await fetch("/api/p2p/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await readJson<{ step?: string; ticket?: string; challenge?: string; error?: string; code?: string }>(res);
    setLoading(false);

    if (!res.ok) {
      if (data?.code === "email_unverified") setEmailUnverified(true);
      setError(data?.error ?? "Unable to sign in.");
      return;
    }

    if (data?.step === "2fa" && data.challenge) {
      setChallenge(data.challenge);
      setTwoFactorCode("");
      setStep("twoFactor");
      return;
    }

    if (data?.step === "done" && data.ticket) {
      await completeLogin(email, data.ticket);
    }
  }

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/p2p/auth/login/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge, code: twoFactorCode })
    });
    const data = await readJson<{ ticket?: string; error?: string }>(res);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Invalid code.");
      return;
    }

    if (data?.ticket) {
      await completeLogin(email, data.ticket);
    }
  }

  async function handleResendVerification() {
    setError("");
    setResent(false);
    const res = await fetch("/api/p2p/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (res.ok) setResent(true);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
  }

  const isSignedIn = Boolean(session?.user?.email);

  if (isSignedIn) {
    return (
      <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Welcome to Kwizerana</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">You&apos;re signed in</h1>
          </div>
          <div className="mt-8 border border-line bg-panel p-4">
            <p className="font-semibold">{session?.user?.name ?? "Signed-in account"}</p>
            <p className="mt-1 text-sm text-muted">{session?.user?.email}</p>
          </div>
          <Link href="/" className="mt-4 inline-flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Welcome to Kwizerana</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            {step === "twoFactor" ? "Two-factor authentication" : "Sign in"}
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            {step === "twoFactor"
              ? "Enter the 6-digit code from your authenticator app, or a backup code."
              : "Sign in to browse, trade, and manage your account."}
          </p>
        </div>

        <div className="mt-8">
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
                  placeholder="Your password"
                />
              </div>

              {error && (
                <div className="border border-coral/40 bg-coral/10 p-3 text-sm leading-6">
                  <p className="font-semibold">{error}</p>
                  {emailUnverified && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      className="mt-2 font-semibold text-ocean underline underline-offset-2"
                    >
                      Resend verification email
                    </button>
                  )}
                  {resent && <p className="mt-2 text-moss">Verification email sent. Check your inbox.</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              <div>
                <label htmlFor="twoFactorCode" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Authentication code
                </label>
                <input
                  id="twoFactorCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="h-11 w-full border border-line bg-white px-3 text-center text-lg tracking-[0.3em] outline-none transition-colors focus:border-ocean"
                  placeholder="••••••"
                  maxLength={11}
                />
              </div>

              {error && (
                <div className="border border-coral/40 bg-coral/10 p-3 text-sm leading-6">
                  <p className="font-semibold">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify & sign in
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("credentials");
                  setError("");
                }}
                className="mx-auto flex items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
            </form>
          )}
        </div>

        {step === "credentials" && (
          <>
            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <button
              disabled={!config.google || status === "loading" || googleLoading}
              onClick={handleGoogleSignIn}
              className="flex h-11 w-full items-center justify-center gap-2 border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              Continue with Google
            </button>

            {checkedConfig && !config.google && (
              <div className="mt-4 border border-line bg-panel p-4 text-sm leading-6 text-muted">
                Google sign-in is not configured. You can still sign in with email and password.
              </div>
            )}
          </>
        )}

        {step === "credentials" && (
          <p className="mt-6 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="font-semibold text-ocean underline underline-offset-2">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
