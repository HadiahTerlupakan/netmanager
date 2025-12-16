'use client'

import { useEffect, useState } from 'react'
import { useSocketEvent } from '@/hooks/useSocket'

interface StatsData {
  totalBarang: number
  totalStok: number
  totalGudang: number
  lowStock: number
}

export function StatsCards() {
  const [stats, setStats] = useState<StatsData>({
    totalBarang: 0,
    totalStok: 0,
    totalGudang: 0,
    lowStock: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/inventory/barang?limit=1')
      const data = await response.json()

      // Get gudang count
      const gudangResponse = await fetch('/api/inventory/gudang')
      const gudangData = await gudangResponse.json()

      // Calculate stats
      const totalBarang = data.pagination?.total || 0
      const totalStok = data.barangs?.reduce((sum: number, item: any) => sum + (item.totalStock || 0), 0)
      const totalGudang = gudangData.gudangs?.length || 0

      // Get low stock items (stok < 5)
      const lowStockResponse = await fetch('/api/inventory/barang?limit=100')
      const lowStockData = await lowStockResponse.json()
      const lowStock = lowStockData.barangs?.filter((item: any) => {
        const minStock = Math.min(...(item.stockPerGudang?.map((s: any) => s.stok) || [Infinity]))
        return minStock < 5
      }).length || 0

      setStats({
        totalBarang,
        totalStok,
        totalGudang,
        lowStock
      })
    } catch (error) {
      console.error('Failed to fetch inventory stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // Listen for inventory updates
  useSocketEvent('inventory:update', () => {
    console.log('[Inventory] Stats received update, refreshing...')
    fetchStats()
  })

  useEffect(() => {
    fetchStats()
  }, [])

  const statsCards = [
    {
      title: 'Total Barang',
      value: loading ? '...' : stats.totalBarang.toLocaleString('id-ID'),
      icon: (
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8-4-8 4M14 10h4a2 2 0 002-2v-4a2 2 0 00-2-2h-4a2 2 0 00-2 2v4a2 2 0 002 2h4zM10 0V6a2 2 0 00-2-2H4a2 2 0 00-2 2v4a2 2 0 002 2h4z" />
        </svg>
      ),
      color: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Total Stok',
      value: loading ? '...' : stats.totalStok.toLocaleString('id-ID'),
      icon: (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0m0 4v4m0 4l8 0m-8-4l8 0M9 3v6m0 0V9m0 0h6" />
        </svg>
      ),
      color: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Gudang',
      value: loading ? '...' : stats.totalGudang.toLocaleString('id-ID'),
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1" />
        </svg>
      ),
      color: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Stok Menipis',
      value: loading ? '...' : stats.lowStock.toLocaleString('id-ID'),
      icon: (
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.932-3.402L6.732 4.697A10.966 10.966 0 013.172 7.331c-1.54 0-3.093-.643-4.114-1.931L6.732 14.697c-1.43 1.264-2.717 2.063-3.878 2.312-1.261.25-2.548-.345-4.114-.345-1.94 0-3.24.8-4.414 1.93-1.173 1.13-2.46 2.08-3.878 2.312-1.051.348-2.338.693-4.114.345-.57 0-1.173-.095-1.94-.345-1.417-1.272-2.704-2.06-3.878-2.312z" />
        </svg>
      ),
      color: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-600 dark:text-red-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.color} rounded-lg p-4`}>
          <div className="flex items-center">
            <div className={`${stat.textColor} p-3 rounded-full`}>
              {stat.icon}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                {stat.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}