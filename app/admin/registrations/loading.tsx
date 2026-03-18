// Registrations skeleton - pending registrations list with customer info
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-52 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 px-4 w-28 bg-gray-200 dark:bg-gray-700 rounded-full" />
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-9 flex-1 max-w-sm bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Registration cards */}
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between animate-pulse">
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
