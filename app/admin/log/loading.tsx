// Log activity skeleton - timeline / table of system activity logs
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 flex-1 max-w-md bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Log table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0 items-start"
          >
            <div className="space-y-1">
              <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
              <div className="h-3 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="space-y-1">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
