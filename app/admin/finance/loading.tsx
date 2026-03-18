// Finance dashboard skeleton - income summary, charts, transaction table
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 animate-pulse">
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Transactions table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 py-1">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-4 bg-gray-200 dark:bg-gray-700 rounded" style={{ opacity: 1 - j * 0.08 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
