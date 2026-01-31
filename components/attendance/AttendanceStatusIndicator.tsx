'use client'

import { useEffect, useState } from 'react'
import { format, differenceInSeconds } from 'date-fns'
import { id } from 'date-fns/locale'

interface AttendanceStatusIndicatorProps {
  checkInTime: Date
  checkOutTime?: Date
  targetHours: number
  workingHourMode: 'FIXED' | 'FLEXIBLE'
  status: 'ON_TIME' | 'LATE'
}

export function AttendanceStatusIndicator({
  checkInTime,
  checkOutTime,
  targetHours,
  workingHourMode,
  status
}: AttendanceStatusIndicatorProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [duration, setDuration] = useState('00:00')
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  
  useEffect(() => {
    const updateDuration = () => {
      const endTime = checkOutTime || currentTime
      const diff = differenceInSeconds(endTime, checkInTime)
      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      setDuration(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`)

      // Calculate progress for flexible users
      if (workingHourMode === 'FLEXIBLE' && !checkOutTime) {
        const durationHours = diff / 3600
        const progressPercent = Math.min((durationHours / targetHours) * 100, 100)
        setProgress(progressPercent)
      }
    }

    // Defer state updates to avoid synchronous setState in effect
    requestAnimationFrame(updateDuration)
  }, [currentTime, checkInTime, checkOutTime, targetHours, workingHourMode])
  
  const isLate = status === 'LATE'
  
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Status Kehadiran
        </span>
        {isLate && !checkOutTime && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
            TERLAMBAT
          </span>
        )}
        {!isLate && checkOutTime && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
            TEPAT WAKTU
          </span>
        )}
      </div>
      
      <div className="text-center mb-4">
        <p className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
          {duration}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Durasi Kerja
        </p>
      </div>
      
      {workingHourMode === 'FLEXIBLE' && !checkOutTime && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">
              Target: {targetHours} jam
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      
      {!checkOutTime && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {format(currentTime, 'HH:mm', { locale: id })} - Waktu Sekarang
          </p>
        </div>
      )}
    </div>
  )
}
