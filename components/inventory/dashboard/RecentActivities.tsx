'use client'

import { HiOutlineArrowDownCircle, HiOutlineArrowUpCircle, HiOutlineArrowsRightLeft } from 'react-icons/hi2'

interface Activity {
  type: 'MASUK' | 'KELUAR' | 'TRANSFER'
  barang: string
  kode: string
  gudang: string
  jumlah: number
  user: string
  timestamp: string
}

interface Props {
  activities: Activity[]
  loading: boolean
}

function formatRelativeTime(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  
  return then.toLocaleDateString('id-ID', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function RecentActivities({ activities, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'MASUK':
        return <HiOutlineArrowDownCircle className="w-5 h-5 text-green-500" />
      case 'KELUAR':
        return <HiOutlineArrowUpCircle className="w-5 h-5 text-orange-500" />
      case 'TRANSFER':
        return <HiOutlineArrowsRightLeft className="w-5 h-5 text-blue-500" />
      default:
        return null
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'MASUK':
        return 'bg-green-100 dark:bg-green-900/30'
      case 'KELUAR':
        return 'bg-orange-100 dark:bg-orange-900/30'
      case 'TRANSFER':
        return 'bg-blue-100 dark:bg-blue-900/30'
      default:
        return 'bg-gray-100 dark:bg-gray-700'
    }
  }

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'MASUK':
        return 'Masuk'
      case 'KELUAR':
        return 'Keluar'
      case 'TRANSFER':
        return 'Transfer'
      default:
        return type
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        📋 Aktivitas Terbaru
      </h3>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {activities.length > 0 ? (
          activities.map((activity, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    activity.type === 'MASUK' ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300' :
                    activity.type === 'KELUAR' ? 'bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300' :
                    'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                  }`}>
                    {getActivityLabel(activity.type)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white text-sm mt-1 truncate">
                  {activity.barang}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activity.jumlah} unit • {activity.gudang} • oleh {activity.user}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Belum ada aktivitas
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
