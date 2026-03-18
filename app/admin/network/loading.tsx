// Network (mikrotik/ACS/radius) skeleton - device table with status badges
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
        ))}
      </div>

      {/* Device status summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Perangkat', color: 'bg-blue-100 dark:bg-blue-900/30' },
          { label: 'Online', color: 'bg-green-100 dark:bg-green-900/30' },
          { label: 'Offline', color: 'bg-red-100 dark:bg-red-900/30' },
        ].map((card, i) => (
          <div key={i} className={`${card.color} rounded-xl p-4 space-y-2 animate-pulse`}>
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-600 rounded" />
            <div className="h-8 w-12 bg-gray-200 dark:bg-gray-600 rounded" />
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-3 animate-pulse">
        <div className="h-9 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Devices table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden animate-pulse">
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b border-gray-100 dark:border-gray-700/50 last:border-0 items-center">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
              <div className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
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
