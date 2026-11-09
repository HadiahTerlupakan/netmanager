import type { Metadata } from "next";

import BelanjaClient from "./BelanjaClient";

export const metadata: Metadata = {
  title: "Daftar Belanja",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const dynamic = "force-static";

/**
 * Halaman daftar belanja tanpa login. Token ada di fragmen URL (`#…`) yang
 * tidak pernah dikirim ke server, jadi halaman ini statis dan semua data
 * dimuat di browser lewat POST.
 */
export default function BelanjaPage() {
  return <BelanjaClient />;
}
