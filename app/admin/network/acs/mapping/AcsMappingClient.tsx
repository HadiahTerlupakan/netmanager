"use client"

import { useState, useEffect } from 'react'
import { MapPin, RefreshCw, Layers } from 'lucide-react'

// Dummy simple map view since we don't have Leaflet installed 
// In a real app we'd use react-leaflet or similar
export function AcsMappingClient() {
  const [mappings, setMappings] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMappings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acs/mapping')
      const result = await res.json()
      if (result.success) {
        setMappings(result.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMappings()
  }, [])

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center">
            <MapPin className="w-6 h-6 mr-2 text-[#16a34a] dark:text-green-500" /> Pemetaan ONT
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Titik lokasi pemasangan Router/ONT Pelanggan</p>
        </div>
        <button
          onClick={fetchMappings}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 shadow-sm transition-colors"
        >
          <RefreshCw className={"w-4 h-4 mr-2 " + (loading ? "animate-spin" : "")} /> Refresh Map
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 min-h-[600px] flex flex-col items-center justify-center text-center">
        {loading ? (
          <RefreshCw className="w-12 h-12 text-blue-500 dark:text-blue-400 animate-spin mb-4" />
        ) : mappings.length > 0 ? (
          <div className="w-full h-[500px] bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            {/* Here would go the <MapContainer> from react-leaflet */}
            <div className="text-gray-400 dark:text-gray-500 font-medium">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              Ditemukan {mappings.length} titik koordinat.<br />
              (Komponen Peta Leaflet belum terinstall di Next.js)
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Layers className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Belum ada Pemetaan Data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Anda belum memiliki titik koordinat pelanggan yang tersimpan. Gunakan fitur Tagging pada perangkat di GenieACS untuk menambahkan (format: <code className="bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded text-gray-800 dark:text-gray-300">map:Nama:Lat:Lng</code>).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
