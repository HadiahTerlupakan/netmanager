/** Kerangka halaman tagihan selama sesi dan daftar tagihan dimuat. */
export function TagihanSkeleton() {
  return (
    <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] max-w-md mx-auto flex flex-col items-center">
      <div className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1a2632] border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="w-full p-4">
        <div className="w-full h-56 bg-[#0d9488]/50 rounded-xl animate-pulse" />
      </div>
      <div className="w-full px-4 mt-2">
        <div className="w-40 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
        <div className="w-full h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-3" />
        <div className="w-full h-24 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
