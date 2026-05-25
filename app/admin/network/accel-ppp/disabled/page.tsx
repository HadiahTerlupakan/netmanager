import Link from "next/link";
import { redirect } from "next/navigation";
import { HiArrowLeft, HiOutlineExclamationTriangle } from "react-icons/hi2";
import { ensurePermission } from "@/lib/rbac";
import { getFullRadiusMode } from "@/modules/settings";

export const dynamic = "force-dynamic";

export default async function AccelPppDisabledPage() {
  await ensurePermission("accel_ppp:read");
  if (await getFullRadiusMode()) {
    redirect("/admin/network/accel-ppp");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-8">
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          title="Kembali"
        >
          <HiArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Modul Accel-PPP
        </h1>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
        <HiOutlineExclamationTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
            Full RADIUS Mode belum aktif
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Modul Accel-PPP membutuhkan toggle <strong>Full RADIUS Mode</strong>{" "}
            dalam keadaan aktif. Saat ini toggle masih OFF, sehingga halaman ini
            dan endpoint API accel-ppp ditolak (403).
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Cara mengaktifkan
        </h2>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          <li>
            Buka{" "}
            <Link
              href="/admin/pengaturan/umum"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Pengaturan → Umum
            </Link>
          </li>
          <li>
            Scroll ke section <strong>Jaringan &amp; PPP</strong>
          </li>
          <li>
            Aktifkan toggle <strong>Full RADIUS Mode (accel-ppp)</strong>
          </li>
          <li>Halaman ini akan otomatis dialihkan ke daftar server</li>
        </ol>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Catatan: pastikan permission user kamu sudah include{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-900">
            accel_ppp:read
          </code>{" "}
          dan permission terkait. Lihat dokumentasi setup di{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-900">
            docs/guides/accel-ppp-setup.md
          </code>
          .
        </p>
      </div>
    </div>
  );
}
