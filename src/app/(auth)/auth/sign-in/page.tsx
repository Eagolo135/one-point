"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/features/auth/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { user, isReady, isGoogleReady, signInWithGoogle, isCalendarScopeGranted } = useAuth();

  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isMissingGoogleClientId = !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (isReady && user) {
      router.replace("/assistant");
    }
  }, [isReady, user, router]);

  async function submit() {
    setPending(true);
    setStatus(null);
    try {
      await signInWithGoogle();
      router.push("/assistant");
    } catch (caughtError) {
      setStatus(caughtError instanceof Error ? caughtError.message : "Auth failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="onpoint-shell flex min-h-screen items-center justify-center px-4 py-8">
      <section className="onpoint-card w-full max-w-md border-gold/30 p-6 shadow-[0_0_0_1px_rgba(200,162,77,0.15),0_20px_60px_rgba(0,0,0,0.5)] md:p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">On Point</p>
        <h1 className="mt-2 text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Continue securely with your Google account.
        </p>

        <div className="mt-4 rounded-md border border-gold/40 bg-gold/10 p-3 text-xs text-zinc-200">
          On Point requests Google Calendar permission so the app can read your events and create/update calendar items.
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-lg border border-gold bg-gold/15 px-4 py-2.5 font-medium text-gold-strong disabled:opacity-60"
        >
          {pending ? "Please wait..." : "Continue with Google"}
        </button>

        {status ? <p className="mt-2 text-xs text-red-300">{status}</p> : null}
        {isCalendarScopeGranted ? <p className="mt-2 text-xs text-emerald-300">Calendar scope granted.</p> : null}

        {isMissingGoogleClientId ? (
          <p className="mt-3 text-xs text-amber-300">Missing env: NEXT_PUBLIC_GOOGLE_CLIENT_ID</p>
        ) : null}
        {!isGoogleReady && !isMissingGoogleClientId ? (
          <p className="mt-3 text-xs text-zinc-400">Loading Google identity services…</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end text-sm">
          <Link href="/assistant" className="text-gold-strong underline-offset-4 hover:underline">
            Continue to app
          </Link>
        </div>
      </section>
    </main>
  );
}
