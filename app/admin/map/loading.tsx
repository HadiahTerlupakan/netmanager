// Map/network topology skeleton - toolbar + full-width map canvas
export default function Loading() {
  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse">
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>

      {/* Map canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar legend */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4 animate-pulse shrink-0">
          <div className="h-5 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
              <div className="h-3 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>

        {/* Map area */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 animate-pulse relative">
          {/* Fake grid lines */}
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
          {/* Fake nodes scattered on map */}
          {[
            { top: '20%', left: '25%' }, { top: '35%', left: '55%' },
            { top: '55%', left: '35%' }, { top: '70%', left: '65%' },
            { top: '45%', left: '75%' }, { top: '30%', left: '80%' },
          ].map((pos, i) => (
            <div
              key={i}
              className="absolute h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded-full border-2 border-white dark:border-gray-800 animate-pulse"
              style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
