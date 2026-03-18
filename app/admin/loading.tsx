// Admin Dashboard - skeleton for stat cards + charts + recent activity
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Page title */}
      <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>

      {/* Recent activity table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
        <div className="h-5 w-44 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
