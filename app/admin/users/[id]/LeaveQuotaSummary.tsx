'use client'

import { useState, useEffect } from 'react'
import { HiOutlineCalendarDays } from 'react-icons/hi2'

interface LeaveBalanceData {
  leaveType: string
  quota: number
  used: number
  remaining: number
}

interface Props {
  userId: string
  workingHourMode?: string
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CUTI: 'Cuti',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  LAINNYA: 'Lainnya',
  TUKAR_LIBUR: 'Tukar Libur'
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CUTI: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  SAKIT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  IZIN: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  LAINNYA: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
  TUKAR_LIBUR: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
}

/**
 * Compact leave quota display for user profile view mode
 */
export default function LeaveQuotaSummary({ userId, workingHourMode }: Props) {
  const [balances, setBalances] = useState<LeaveBalanceData[]>([])
  const [loading, setLoading] = useState(true)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (workingHourMode !== 'FLEXIBLE') {
      fetchBalances()
    } else {
      setLoading(false)
    }
  }, [userId, workingHourMode])

  const fetchBalances = async () => {
    try {
      const res = await fetch(`/api/admin/leave-balance?userId=${userId}&year=${currentYear}`)
      const data = await res.json()
      if (res.ok) {
        // Filter out TUKAR_LIBUR (unlimited)
        const responseData = data.data || data
        setBalances((responseData.balances || []).filter((b: LeaveBalanceData) => b.leaveType !== 'TUKAR_LIBUR'))
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error)
    } finally {
      setLoading(false)
    }
  }

  // FLEXIBLE users don't have leave quotas
  if (workingHourMode === 'FLEXIBLE') {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-linear-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
            <HiOutlineCalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sisa Kuota Cuti {currentYear}</h3>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map(balance => {
            const colorClass = LEAVE_TYPE_COLORS[balance.leaveType] || LEAVE_TYPE_COLORS.LAINNYA
            const isLow = balance.remaining <= 2 && balance.remaining > 0
            const isEmpty = balance.remaining <= 0

            return (
              <div
                key={balance.leaveType}
                className={`rounded-lg p-3 text-center ${colorClass}`}
              >
                <div className="text-xs font-medium opacity-80 mb-1">
                  {LEAVE_TYPE_LABELS[balance.leaveType] || balance.leaveType}
                </div>
                <div className={`text-2xl font-bold ${isEmpty ? 'text-red-600 dark:text-red-400' : isLow ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                  {balance.remaining}
                </div>
                <div className="text-xs opacity-60">
                  dari {balance.quota} hari
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
