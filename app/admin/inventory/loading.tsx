// Inventory skeleton - filter bar + stock summary cards + items table
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header + action */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
        ))}
      </div>

      {/* Stock summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-7 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>

      {/* Search + filter row */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-9 flex-1 max-w-xs bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {['w-4', 'w-32', 'w-20', 'w-16', 'w-20', 'w-16'].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-gray-200 dark:bg-gray-700 rounded`} />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
