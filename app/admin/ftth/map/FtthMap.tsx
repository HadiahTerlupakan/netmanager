import TopologyMap from '@/components/ftth/TopologyMap'

export default function TopologyMapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Peta Topologi FTTH</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Visualisasi semua lokasi infrastruktur FTTH dengan garis topologi yang menghubungkan OTB, ODC, dan ODP.
        </p>
      </div>
      <TopologyMap />
    </div>
  )
}

