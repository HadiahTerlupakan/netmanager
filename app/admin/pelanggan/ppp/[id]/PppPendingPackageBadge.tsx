"use client";

import { useRouter } from "next/navigation";
import { HiOutlineClock } from "react-icons/hi2";

type PppPendingPackageBadgeProps = {
  pelangganId: string;
  pendingPackageName: string | null | undefined;
  pendingPackageApplyAt: string;
};

/**
 * Badge yang menampilkan informasi perubahan paket yang dijadwalkan
 * beserta tombol untuk membatalkannya.
 */
export function PppPendingPackageBadge({
  pelangganId,
  pendingPackageName,
  pendingPackageApplyAt,
}: PppPendingPackageBadgeProps) {
  const router = useRouter();

  const handleCancel = async () => {
    if (!confirm("Batalkan perubahan paket yang dijadwalkan?")) return;

    const res = await fetch(
      `/api/pelanggan-ppp/${pelangganId}/cancel-pending-package`,
      { method: "POST" },
    );

    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      alert(data.error ?? "Gagal membatalkan perubahan paket");
    }
  };

  const formattedDate = new Date(pendingPackageApplyAt).toLocaleDateString(
    "id-ID",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div className="mx-8 mt-4 p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center gap-3">
      <HiOutlineClock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
      <span className="text-amber-700 dark:text-amber-300 text-sm font-medium flex-1">
        Paket akan berubah ke{" "}
        <strong>{pendingPackageName ?? "paket baru"}</strong> pada{" "}
        <strong>{formattedDate}</strong>
      </span>
      <button
        onClick={handleCancel}
        className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded whitespace-nowrap transition-colors"
      >
        Batalkan
      </button>
    </div>
  );
}
