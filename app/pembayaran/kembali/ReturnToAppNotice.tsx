"use client";

import Link from "next/link";
import { useEffect } from "react";

const APP_BILLING_DEEP_LINK = "netmanager://tagihan";

function openUrl(url: string) {
  window.location.href = url;
}

/**
 * Mengembalikan pelanggan ke halaman Tagihan aplikasi setelah membayar di
 * browser. Browser bisa menahan deep link yang tidak dipicu ketukan, jadi
 * tombolnya tetap disediakan. `openDeepLink` hanya diganti di tes.
 */
export function ReturnToAppNotice({
  openDeepLink = openUrl,
}: {
  openDeepLink?: (url: string) => void;
}) {
  useEffect(() => {
    openDeepLink(APP_BILLING_DEEP_LINK);
  }, [openDeepLink]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4 dark:bg-[#101922]">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-[#1a2632]">
        <h1 className="text-lg font-bold text-[#111418] dark:text-white">
          Kembali ke aplikasi
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Status pembayaran Anda bisa dilihat di halaman Tagihan aplikasi
          RADPRO.
        </p>
        <a
          href={APP_BILLING_DEEP_LINK}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#0d9488] px-4 text-sm font-semibold text-white hover:bg-[#0f766e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a2632]"
        >
          Kembali ke aplikasi RADPRO
        </a>
        <Link
          href="/tagihan"
          className="mt-4 inline-block text-xs font-medium text-[#0d9488] underline-offset-4 hover:underline"
        >
          Buka di portal
        </Link>
      </div>
    </main>
  );
}
