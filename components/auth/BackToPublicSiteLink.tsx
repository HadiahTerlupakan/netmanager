import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi2";
import { getPublicSiteUrl } from "@/lib/utils/env";

/**
 * Tautan keluar dari halaman login menuju situs publik.
 *
 * Portal berjalan di subdomain yang seluruh path-nya dijaga `proxy.ts`, jadi
 * pengguna yang sudah logout tidak punya jalan kembali ke landing page kecuali
 * mengetik alamat apex secara manual.
 */
export default function BackToPublicSiteLink(): React.ReactElement {
  return (
    <div className="text-center mt-6">
      <Link
        href={getPublicSiteUrl()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <HiArrowLeft className="w-4 h-4" />
        Kembali ke beranda
      </Link>
    </div>
  );
}
