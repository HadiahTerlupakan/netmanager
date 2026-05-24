import Link from "next/link";
import { redirect } from "next/navigation";
import { ensurePermission } from "@/lib/rbac";
import { getFullRadiusMode } from "@/modules/settings";

export const dynamic = "force-dynamic";

export default async function AccelPppDisabledPage() {
  await ensurePermission("accel_ppp:read");
  if (await getFullRadiusMode()) {
    redirect("/admin/network/accel-ppp");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-12">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="mb-2 text-lg font-semibold text-amber-900">
          Full RADIUS Mode belum aktif
        </h1>
        <p className="text-sm text-amber-800">
          Modul Accel-PPP membutuhkan toggle <strong>Full RADIUS Mode</strong>{" "}
          dalam keadaan aktif. Saat ini toggle masih OFF, sehingga halaman ini
          dan endpoint API accel-ppp ditolak (403).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          Cara mengaktifkan
        </h2>
        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
          <li>
            Buka{" "}
            <Link
              href="/admin/pengaturan/umum"
              className="text-blue-600 hover:underline"
            >
              Pengaturan → Umum
            </Link>
          </li>
          <li>
            Cari section <strong>Jaringan &amp; PPP</strong>
          </li>
          <li>
            Aktifkan toggle <strong>Full RADIUS Mode (accel-ppp)</strong>
          </li>
          <li>Refresh halaman ini</li>
        </ol>
        <p className="pt-2 text-xs text-slate-500">
          Catatan: pastikan permission user kamu sudah include{" "}
          <code className="rounded bg-slate-100 px-1">accel_ppp:read</code> dan
          permission terkait.
        </p>
      </div>
    </div>
  );
}
