// Support tickets skeleton - ticket list with priority badges and status
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {['Semua', 'Baru', 'Proses', 'Selesai'].map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-1 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 flex-1 max-w-sm bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Ticket list */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden animate-pulse">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex items-center gap-3">
                <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
