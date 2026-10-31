"use client";

import { useSearchParams } from "next/navigation";
import { getCustomerLoginReasonMessage } from "@/lib/customer-login-reason";

/**
 * Menjelaskan mengapa pelanggan dikeluarkan (mis. dismantle) dari kode
 * `?reason=` di URL login. Pakai di dalam `<Suspense>`: `useSearchParams`
 * membutuhkannya agar halaman tetap bisa dirender statis.
 */
export function CustomerLoginReasonNotice() {
  const message = getCustomerLoginReasonMessage(
    useSearchParams().get("reason"),
  );
  if (!message) return null;

  return (
    <div
      role="status"
      className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50"
    >
      <p className="text-sm text-amber-800 dark:text-amber-300 text-center font-medium">
        {message}
      </p>
    </div>
  );
}
