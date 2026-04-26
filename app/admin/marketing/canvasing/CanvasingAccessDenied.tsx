import { HiOutlineLockClosed } from "react-icons/hi2";

/** Render access denied state for canvasing page. */
export default function CanvasingAccessDenied() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4 dark:bg-red-900/20">
        <HiOutlineLockClosed className="h-12 w-12 text-red-500" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
        Akses Terbatas
      </h2>
      <p className="max-w-md text-gray-500 dark:text-gray-400">
        Anda tidak memiliki izin untuk mengakses halaman Canvasing. Hubungi
        administrator untuk mendapatkan akses.
      </p>
    </div>
  );
}
