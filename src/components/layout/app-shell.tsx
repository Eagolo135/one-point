"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { ReactNode } from "react";

import { APP_NAV_ITEMS } from "@/config/navigation";
import { useAuth } from "@/features/auth/auth-context";

import { AppNav } from "./app-nav";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { user, isReady, signOut } = useAuth();

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/auth/sign-in");
    }
  }, [isReady, user, router]);

  if (!isReady || !user) {
    return (
      <div className="onpoint-shell flex min-h-screen items-center justify-center px-4 text-sm text-zinc-300">
        Loading secure workspace...
      </div>
    );
  }

  return (
    <div className="onpoint-shell min-h-screen text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-6xl space-y-4 px-4 pb-8 pt-5 md:px-6">
        <section className="onpoint-card p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold">On Point</p>
              <h2 className="mt-1 text-xl font-semibold">Command Center</h2>
              <p className="mt-1 text-xs text-zinc-300 break-all">{user.email}</p>
            </div>
            <button
              onClick={() => {
                signOut();
                router.push("/auth/sign-in");
              }}
              className="w-full rounded-md border border-surface-border px-3 py-2 text-sm text-zinc-200 md:w-auto"
            >
              Log out
            </button>
          </div>

          <div className="mt-4">
            <AppNav items={APP_NAV_ITEMS} mobile />
          </div>
        </section>

        <div className="pb-2">
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
