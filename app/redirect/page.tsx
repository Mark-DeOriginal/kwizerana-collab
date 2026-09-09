import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { authHref, safeReturnPath } from "@/lib/auth/redirects";

export const metadata = {
  title: "Sign in required"
};

export default async function SignInRequiredPage({
  searchParams
}: {
  searchParams?: { next?: string };
}) {
  const returnTo = safeReturnPath(searchParams?.next);
  const session = await getServerSession(authOptions);

  if (session?.user) redirect(returnTo);

  return (
    <div className="px-4 py-14 text-ink sm:px-6 sm:py-20 lg:px-8">
      <section className="mx-auto grid max-w-5xl overflow-hidden border border-line bg-white shadow-tight lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[320px] flex-col justify-between bg-ink p-7 text-white sm:p-10">
          <div className="grid h-12 w-12 place-items-center border border-white/20 bg-white/10" aria-hidden="true">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-mint">Private workspace</p>
            <h1 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Your account is required to continue.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/70">
              Sign in to return to the page you requested and continue securely.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          <p className="text-sm font-semibold text-ocean">Continue to Kwizerana</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Choose how you want to continue</h2>
          <p className="mt-3 max-w-lg text-base leading-7 text-muted">
            Already have an account? Sign in. New here? Create an account, then we will bring you back to where you were going.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href={authHref("/auth/sign-in", returnTo)}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-5 text-base font-semibold text-white hover:bg-ocean"
            >
              Sign in
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={authHref("/auth/sign-up", returnTo)}
              className="inline-flex min-h-12 items-center justify-center border border-line bg-white px-5 text-base font-semibold text-ink hover:border-ocean hover:bg-panel"
            >
              Create account
            </Link>
          </div>

          <div className="mt-7 flex items-start gap-3 border-t border-line pt-6 text-sm leading-6 text-muted">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
            <p>Protected pages stay unavailable until your session has been confirmed.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
