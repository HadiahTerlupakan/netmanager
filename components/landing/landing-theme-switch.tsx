"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cx, EASE } from "./landing-content";

/** Client-only mount flag without setState-in-effect (SSR-safe). */
export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Theme toggle for the island nav — renders a stable placeholder on SSR. */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-zinc-200/80 dark:ring-white/10"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300 ring-1 ${cx.ring} transition-colors ${EASE} hover:bg-zinc-100 dark:hover:bg-zinc-800`}
      aria-label={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
