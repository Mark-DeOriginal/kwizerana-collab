"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { readJson } from "@/lib/client-request";

export default function SignUpPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

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
