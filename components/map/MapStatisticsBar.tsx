interface MapStatisticsBarProps {
  statistics: {
    totalNodes: number
    totalEdges: number
    nodesByType: Record<string, number>
  }
}

export function MapStatisticsBar({ statistics }: MapStatisticsBarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex gap-6">
        <StatCard label="Servers/OLT" value={statistics.nodesByType['olt'] || statistics.nodesByType['server'] || 0} description="Active nodes" color="#9333ea" />
        <StatCard label="ODC Cabinets" value={statistics.nodesByType['odc'] || 0} description="Distribution points" color="#2563eb" />
        <StatCard label="ODP Boxes" value={statistics.nodesByType['odp'] || 0} description="Drop points" color="#06b6d4" />
        <StatCard label="ONT Devices" value={statistics.nodesByType['ont'] || 0} description="Customer units" color="#ea580c" />
      </div>
    </div>
  )
}

function StatCard({ label, value, description, color }: { label: string; value: number; description: string; color: string }) {
  return (
    <div className="flex-1 flex items-center gap-3">
      <div className="w-1 h-12 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
    </div>
  )
}
