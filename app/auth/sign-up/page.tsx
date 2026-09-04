"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { readJson } from "@/lib/client-request";

type Config = { google?: boolean };

export default function SignUpPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [config, setConfig] = useState<Config>({});
  const [checkedConfig, setCheckedConfig] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => readJson<Config>(response))
      .then((payload) => {
        if (payload) setConfig(payload);
      })
      .finally(() => setCheckedConfig(true));
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      router.replace("/");
    }
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/p2p/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    const data = await readJson<{ error?: string }>(res);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Unable to create account.");
      return;
    }

    setRegisteredEmail(email);
    setDone(true);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
  }

  if (done) {
    return (
      <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-start gap-3 border border-mint bg-panel p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
            <div>
              <p className="font-semibold">Verify your email</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                We sent a verification link to <span className="font-semibold text-ink">{registeredEmail}</span>.
                Click the link to activate your account, then sign in.
              </p>
            </div>
          </div>
          <Link href="/auth/sign-in" className="mt-4 inline-flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Join Kwizerana</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">Create your account</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            A decentralized marketplace for trading crypto directly with other people. No KYC required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Display name <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="Your name"
            />
          </div>
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="At least 8 characters"
            />
            <p className="mt-1 text-xs text-muted">Must be at least 8 characters with a letter and a number.</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
              placeholder="Re-enter your password"
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create account
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          disabled={!config.google || status === "loading" || googleLoading}
          onClick={() => void handleGoogleSignIn()}
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
          Sign up with Google
        </button>

        {checkedConfig && !config.google && (
          <div className="mt-4 border border-line bg-panel p-4 text-sm leading-6 text-muted">
            Google sign-in is not configured. You can still create an account with email and password.
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-semibold text-ocean underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
