import { calculateMapDistance } from '@/components/map/map-utils'

type MapFiberDrawingInfoPanelProps = {
  fiberLineMode: string
  fiberSourceNode: {
    name: string
    latitude: number
    longitude: number
  } | null
  fiberWaypoints: [number, number][]
}

export function MapFiberDrawingInfoPanel({ fiberLineMode, fiberSourceNode, fiberWaypoints }: MapFiberDrawingInfoPanelProps) {
  if (fiberLineMode !== 'drawing' || !fiberSourceNode) {
    return null
  }

  const totalDistance = fiberWaypoints.length > 0
    ? `${calculateMapDistance(
        fiberSourceNode.latitude,
        fiberSourceNode.longitude,
        fiberWaypoints[fiberWaypoints.length - 1][0],
        fiberWaypoints[fiberWaypoints.length - 1][1],
        fiberWaypoints.slice(0, -1)
      ).toFixed(1)} m`
    : '0 m'

  return (
    <div className="absolute top-4 left-4 z-1000 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="font-semibold text-gray-900 dark:text-white">Drawing Fiber Line</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-gray-600 dark:text-gray-400">Source:</span>
          <span className="font-medium text-gray-900 dark:text-white">{fiberSourceNode.name}</span>
        </div>
        <div className="text-blue-600 dark:text-blue-400">Click target node</div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Waypoints:</span>
          <span className="font-medium text-gray-900 dark:text-white">{fiberWaypoints.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Distance:</span>
          <span className="font-medium text-gray-900 dark:text-white">{totalDistance}</span>
        </div>
      </div>
    </div>
  )
}
