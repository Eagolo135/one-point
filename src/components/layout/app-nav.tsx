"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/config/navigation";

type AppNavProps = {
  items: NavItem[];
  mobile?: boolean;
};

export function AppNav({ items, mobile = false }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav className={mobile ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5" : "space-y-2"}>
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`onpoint-focusable rounded-lg border px-3 py-2 text-sm font-medium tracking-wide transition ${mobile ? "min-h-[44px] px-2 py-2 text-center text-xs leading-tight" : ""} ${
              active
                ? "border-gold bg-gold/15 text-gold-strong shadow-sm"
                : "border-surface-border bg-surface/70 text-zinc-300 hover:-translate-y-px hover:border-gold/50 hover:text-zinc-100 hover:shadow-sm"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
