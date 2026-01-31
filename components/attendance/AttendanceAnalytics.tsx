'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { MdTrendingUp, MdTrendingDown, MdAccessTime } from 'react-icons/md'

interface AttendanceAnalyticsProps {
  userId?: string | undefined
}

interface RecentAttendance {
  id: string
  checkIn: string
  checkOut: string | null
  status: 'ON_TIME' | 'LATE'
}

interface AnalyticsData {
  stats: {
    totalDays: number
    onTimeDays: number
    lateDays: number
    avgWorkHours: number
    totalWorkHours: number
    onTimeRate: number
    lateRate: number
  }
  weeklyBreakdown: Array<{
    week: number
    startDate: Date
    endDate: Date
    totalDays: number
    onTimeDays: number
    lateDays: number
  }>
  recentAttendance: RecentAttendance[]
}

export function AttendanceAnalytics({ userId: _userId }: AttendanceAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/attendance/analytics?days=${days}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])
  
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }
  
  if (!data) return null
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Analisis Kehadiran
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
        >
          <option value={7}>7 Hari Terakhir</option>
          <option value={30}>30 Hari Terakhir</option>
          <option value={90}>90 Hari Terakhir</option>
        </select>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
            Total Hari Kerja
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {data.stats.totalDays}
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
            Hari Tepat Waktu
          </p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {data.stats.onTimeDays}
          </p>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">
            Hari Terlambat
          </p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
            {data.stats.lateDays}
          </p>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
            Rata-rata Jam Kerja
          </p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {data.stats.avgWorkHours.toFixed(1)}h
          </p>
        </div>
      </div>
      
      {/* Rates */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex items-center gap-3">
          <MdTrendingUp className="text-green-600 dark:text-green-400" size={24} />
          <div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              Tepat Waktu
            </p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {data.stats.onTimeRate.toFixed(1)}%
            </p>
          </div>
        </div>
        
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-center gap-3">
          <MdTrendingDown className="text-red-600 dark:text-red-400" size={24} />
          <div>
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              Terlambat
            </p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">
              {data.stats.lateRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      
      {/* Weekly Breakdown */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Breakdown Mingguan
        </h3>
        <div className="space-y-3">
          {data.weeklyBreakdown.map((week) => (
            <div key={week.week} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  Minggu {week.week}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {format(week.startDate, 'dd MMM', { locale: id })} - {format(week.endDate, 'dd MMM', { locale: id })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{week.totalDays}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400">Tepat</p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{week.onTimeDays}</p>
                </div>
                <div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Telat</p>
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{week.lateDays}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Recent Attendance */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Kehadiran Terbaru
        </h3>
        <div className="space-y-2">
          {data.recentAttendance.map((att) => (
            <div key={att.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MdAccessTime className="text-blue-600 dark:text-blue-400" size={20} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {format(new Date(att.checkIn), 'EEEE, dd MMMM', { locale: id })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(att.checkIn), 'HH:mm', { locale: id })} - {att.checkOut ? format(new Date(att.checkOut), 'HH:mm', { locale: id }) : 'Belum checkout'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded ${
                att.status === 'LATE' 
                  ? 'bg-yellow-100 text-yellow-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {att.status === 'LATE' ? 'Terlambat' : 'Tepat Waktu'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
