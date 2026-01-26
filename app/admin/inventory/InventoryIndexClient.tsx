'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { BarangTable } from '@/components/inventory/BarangTable'
import { QuickActions } from '@/components/inventory/QuickActions'
import { 
  ExtendedStatsCards, 
  MonthlyTrendChart, 
  MovementRanking, 
  StockAlerts, 
  RecentActivities 
} from '@/components/inventory/dashboard'

interface DashboardData {
  stats: {
    totalJenisBarang: number
    totalStokUnit: number
    totalGudang: number
    totalAsset: number
    lowStockItems: number
    barangMasukBulanIni: number
    barangKeluarBulanIni: number
  }
  monthlyTrend: { month: string; masuk: number; keluar: number }[]
  fastMoving: { id: string; kode: string; nama: string; totalKeluar: number }[]
  slowMoving: { id: string; kode: string; nama: string; lastMovement: string | null; daysSinceLastMove: number | null }[]
  alerts: { barangId: string; kode: string; nama: string; gudang: string; currentStock: number; minStock: number; status: 'LOW' | 'CRITICAL' }[]
  recentActivities: { type: 'MASUK' | 'KELUAR' | 'TRANSFER'; barang: string; kode: string; gudang: string; jumlah: number; user: string; timestamp: string }[]
}

export function ClientComponent() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>({})

  const fetchDashboard = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      
      const url = `/api/inventory/dashboard${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDashboardData(result.data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(dateRange.startDate, dateRange.endDate)
  }, [fetchDashboard, dateRange])

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventory Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola barang dan stok gudang
          </p>
        </div>
        <QuickActions />
      </div>

      {/* Extended Stats Cards */}
      <ExtendedStatsCards stats={dashboardData?.stats || null} loading={loading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart 
          data={dashboardData?.monthlyTrend || []} 
          loading={loading} 
          onDateRangeChange={handleDateRangeChange}
        />
        <MovementRanking 
          fastMoving={dashboardData?.fastMoving || []} 
          slowMoving={dashboardData?.slowMoving || []} 
          loading={loading} 
        />
      </div>

      {/* Alerts & Activities Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StockAlerts alerts={dashboardData?.alerts || []} loading={loading} />
        <RecentActivities activities={dashboardData?.recentActivities || []} loading={loading} />
      </div>

      {/* Barang Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daftar Barang
          </h2>
        </div>
        <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
          <BarangTable />
        </Suspense>
      </div>
    </div>
  )
}