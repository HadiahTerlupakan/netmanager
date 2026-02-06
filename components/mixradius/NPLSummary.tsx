'use client'

import { useState, useEffect } from 'react'
import { HiOutlineExclamationCircle, HiOutlineQuestionMarkCircle } from 'react-icons/hi2'

interface NPLBucket {
  count: number
  sum: number
}

interface NPLStats {
  under30: NPLBucket
  between30And60: NPLBucket
  between60And90: NPLBucket
  over90: NPLBucket
  totalCustomers: number
}

interface NPLSummaryProps {
  groupId?: string
}

export function NPLSummary({ groupId }: NPLSummaryProps) {
  const [stats, setStats] = useState<NPLStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        const url = new URL('/api/integrations/mixradius/npl', window.location.origin)
        if (groupId && groupId !== 'all') {
          url.searchParams.append('groupId', groupId)
        }
        
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error('Failed to fetch NPL statistics')
        }
        const result = await response.json()
        if (result.success) {
          setStats(result.data)
        } else {
          throw new Error(result.message || 'Failed to fetch NPL statistics')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [groupId])

  if (loading) {
    return (
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
          <div className="flex flex-col items-center py-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !stats || !stats.totalCustomers) {
    return null
  }

  const totalUnpaidInvoices = stats.under30.count + stats.between30And60.count + stats.between60And90.count + stats.over90.count
  const nplRatio = (totalUnpaidInvoices / stats.totalCustomers) * 100

  let status = "Sehat"
  let colorClass = "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800"
  let textColor = "text-emerald-700 dark:text-emerald-400"
  let iconColor = "text-emerald-500"
  let badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100"

  if (nplRatio > 15) {
    status = "Bahaya"
    colorClass = "bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800"
    textColor = "text-rose-700 dark:text-rose-400"
    iconColor = "text-rose-500"
    badgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-800 dark:text-rose-100"
  } else if (nplRatio > 5) {
    status = "Waspada"
    colorClass = "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
    textColor = "text-amber-700 dark:text-amber-400"
    iconColor = "text-amber-500"
    badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100"
  }

  return (
    <div className="mb-8">
      <div className={`p-6 rounded-xl border shadow-sm ${colorClass} transition-colors duration-300`}>
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-2">
            <HiOutlineExclamationCircle className={`${iconColor} w-5 h-5`} />
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Rasio NPL (Pelanggan Menunggak)
              </h3>
              <div className="group relative flex items-center">
                <HiOutlineQuestionMarkCircle 
                  className="w-4 h-4 text-gray-400 hover:text-gray-500 cursor-help transition-colors"
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
                  <p className="font-bold mb-1.5 border-b border-gray-700 pb-1">Indikator Kesehatan NPL:</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span>Sehat: 0% - 5%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <span>Waspada: &gt; 5% - 15%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                      <span>Bahaya: &gt; 15%</span>
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className={`text-5xl font-black ${textColor} mb-1`}>
              {nplRatio.toFixed(1)}%
            </span>
            <div className={`px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest ${badgeClass} border border-transparent`}>
              {status}
            </div>
            <p className="mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">
              {totalUnpaidInvoices} dari {stats.totalCustomers} pelanggan tercatat menunggak
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
