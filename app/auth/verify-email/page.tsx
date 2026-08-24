"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { readJson } from "@/lib/client-request";

function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("No verification token was provided.");
      return;
    }

    fetch("/api/p2p/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then((response) => readJson<{ error?: string }>(response))
      .then((data) => {
        if (data?.error) {
          setState("error");
          setMessage(data.error);
        } else {
          setState("success");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <div className="px-4 py-12 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        {state === "loading" && (
          <div className="flex items-center gap-3 border border-line bg-panel p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
            <p className="text-sm text-muted">Verifying your email address…</p>
          </div>
        )}

        {state === "success" && (
          <div>
            <div className="flex items-start gap-3 border border-mint bg-panel p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
              <div>
                <p className="font-semibold">Email verified</p>
                <p className="mt-1 text-sm leading-6 text-muted">Your email address is confirmed. You can now sign in.</p>
              </div>
            </div>
            <Link href="/auth/sign-in" className="mt-4 inline-flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
              Sign in
            </Link>
          </div>
        )}

        {state === "error" && (
          <div>
            <div className="flex items-start gap-3 border border-coral/40 bg-coral/10 p-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
              <div>
                <p className="font-semibold">Verification failed</p>
                <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
              </div>
            </div>
            <Link href="/auth/sign-in" className="mt-4 inline-flex h-10 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean">
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailClient />
    </Suspense>
  );
}
