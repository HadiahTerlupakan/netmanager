import { HiOutlineCheckCircle, HiOutlineXCircle } from "react-icons/hi2";

/** Format tanggal MixRadius untuk tampilan ringkas. */
export function formatMixRadiusDate(dateValue: string) {
  if (!dateValue) return "-";

  return new Date(dateValue).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Cek apakah tanggal pelanggan sudah melewati jatuh tempo. */
export function isMixRadiusExpired(dateValue: string) {
  if (!dateValue) return false;
  return new Date(dateValue) < new Date();
}

/** Bangun badge status akun pelanggan MixRadius. */
export function getMixRadiusStatusBadge(status: string) {
  if (status === "Enabled-Users") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <HiOutlineCheckCircle className="w-3 h-3" />
        Active
      </span>
    );
  }

  if (status === "Disabled-Users") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
        <HiOutlineXCircle className="w-3 h-3" />
        Disabled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
      {status}
    </span>
  );
}
