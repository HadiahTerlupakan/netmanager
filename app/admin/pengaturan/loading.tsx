// Pengaturan (Settings) skeleton - section cards with form fields
export default function Loading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

      {/* Settings nav sidebar + content layout */}
      <div className="flex gap-6">
        {/* Left nav */}
        <div className="w-52 shrink-0 space-y-1 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6">
          {/* Section card 1 */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-5 animate-pulse">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-px bg-gray-200 dark:bg-gray-700" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-3 gap-4 items-start">
                <div className="space-y-1">
                  <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="col-span-2 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            ))}
            <div className="flex justify-end">
              <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>

          {/* Section card 2 */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-5 animate-pulse">
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-px bg-gray-200 dark:bg-gray-700" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="grid grid-cols-3 gap-4 items-center">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="col-span-2 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            ))}
            <div className="flex justify-end">
              <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
