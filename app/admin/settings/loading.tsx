// Settings skeleton - roles/permissions management table
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Roles table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0 items-center">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
              <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="flex flex-wrap gap-1">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              ))}
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Permissions matrix card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-px bg-gray-200 dark:bg-gray-700" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
            <div className="flex gap-3 flex-1">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
