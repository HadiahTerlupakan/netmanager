'use client'

import { useState, useEffect } from 'react'
import { FiBox, FiArrowDownCircle, FiArrowUpCircle, FiMapPin } from 'react-icons/fi'

interface InventoryStatsData {
  totalBarang: number
  barangMasukToday: number
  barangKeluarToday: number
  totalGudang: number
}

export function InventoryStats() {
  const [stats, setStats] = useState<InventoryStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/inventory/stats')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setStats(result.data)
          }
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="ml-4 space-y-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      label: 'Total Jenis Barang',
      value: stats?.totalBarang || 0,
      icon: FiBox,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      darkBgColor: 'dark:bg-blue-900',
      darkTextColor: 'dark:text-blue-400'
    },
    {
      label: 'Total Barang Masuk',
      value: stats?.barangMasukToday || 0,
      icon: FiArrowDownCircle,
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
      darkBgColor: 'dark:bg-green-900',
      darkTextColor: 'dark:text-green-400'
    },
    {
      label: 'Total Barang Keluar',
      value: stats?.barangKeluarToday || 0,
      icon: FiArrowUpCircle,
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-600',
      darkBgColor: 'dark:bg-yellow-900',
      darkTextColor: 'dark:text-yellow-400'
    },
    {
      label: 'Gudang Aktif',
      value: stats?.totalGudang || 0,
      icon: FiMapPin,
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
      darkBgColor: 'dark:bg-purple-900',
      darkTextColor: 'dark:text-purple-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statItems.map((item, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4" style={{ borderColor: item.color === 'blue' ? '#3b82f6' : item.color === 'green' ? '#22c55e' : item.color === 'yellow' ? '#eab308' : '#a855f7' }}>
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${item.bgColor} ${item.darkBgColor}`}>
              <item.icon className={`h-6 w-6 ${item.textColor} ${item.darkTextColor}`} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {item.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {item.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
