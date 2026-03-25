"use client"

import { useState, useEffect } from 'react'
import { HiClock } from 'react-icons/hi2'
import { toZonedTime, format } from 'date-fns-tz'

export function ServerClock() {
  const [time, setTime] = useState<Date | null>(null)
  const [timezone, setTimezone] = useState<string>('Asia/Jakarta')
  const [offset, setOffset] = useState<number>(0)
  const [mounted, setHydrated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // 1. Fetch server time to calculate offset
    const syncTime = async () => {
      try {
        const start = Date.now()
        const res = await fetch('/api/health/time')
        const json = await res.json()
        const end = Date.now()
        
        // Compensate for network latency (half of round-trip time)
        const latency = (end - start) / 2
        
        if (json.success) {
          const serverTime = new Date(json.data.serverTime).getTime()
          const localTime = end
          
          // Offset = Server Time - Local Time
          setOffset(serverTime + latency - localTime)
          setTimezone(json.data.timezone)
        }
      } catch (error) {
        console.error('[ServerClock] Failed to sync time:', error)
      }
    }

    syncTime()

    // 2. Update time every second locally
    const interval = setInterval(() => {
      const now = Date.now()
      setTime(new Date(now + offset))
    }, 1000)

    return () => clearInterval(interval)
  }, [offset])

  if (!mounted || !time) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full" />
        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
      </div>
    )
  }

  // Convert to zoned time for display
  const zonedTime = toZonedTime(time, timezone)
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg shadow-sm">
      <HiClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
      <div className="flex flex-col">
        <span className="text-sm font-bold font-mono text-indigo-900 dark:text-indigo-100 leading-none">
          {format(zonedTime, 'HH:mm:ss', { timeZone: timezone })}
        </span>
        <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium leading-none mt-0.5">
          {timezone.split('/').pop()?.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}
