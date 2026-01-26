'use client'

import { HiOutlineExclamationTriangle, HiOutlineExclamationCircle } from 'react-icons/hi2'

interface AlertItem {
  barangId: string
  kode: string
  nama: string
  gudang: string
  currentStock: number
  minStock: number
  status: 'LOW' | 'CRITICAL'
}

interface Props {
  alerts: AlertItem[]
  loading: boolean
}

export function StockAlerts({ alerts, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          ⚠️ Stock Alerts
        </h3>
        {alerts.length > 0 && (
          <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
            {alerts.length} item
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.length > 0 ? (
          alerts.map((alert, index) => (
            <div
              key={`${alert.barangId}-${index}`}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                alert.status === 'CRITICAL'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {alert.status === 'CRITICAL' ? (
                  <HiOutlineExclamationCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                ) : (
                  <HiOutlineExclamationTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {alert.nama}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alert.gudang} • Min: {alert.minStock}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold ${
                  alert.status === 'CRITICAL' 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {alert.currentStock} unit
                </span>
                <p className={`text-xs ${
                  alert.status === 'CRITICAL'
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-yellow-500 dark:text-yellow-400'
                }`}>
                  {alert.status === 'CRITICAL' ? 'Habis!' : 'Menipis'}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              Semua stok dalam kondisi baik
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
