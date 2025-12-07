'use client'

import { useState } from 'react'
import { HiExclamationCircle, HiClock } from 'react-icons/hi2'
import { CountdownTimer } from './CountdownTimer'

interface ErrorDisplayProps {
  error: string
  errorType?: 'RATE_LIMIT' | 'CREDENTIAL' | 'GENERAL'
  retryAfter?: number
  className?: string
}

export function ErrorDisplay({
  error,
  errorType = 'GENERAL',
  retryAfter,
  className = ''
}: ErrorDisplayProps) {
  const [showCountdown, setShowCountdown] = useState(!!retryAfter && retryAfter > 0)

  const handleCountdownComplete = () => {
    setShowCountdown(false)
  }

  if (errorType === 'RATE_LIMIT') {
    return (
      <div className={`rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 ${className}`}>
        <div className="flex items-start gap-3">
          <HiClock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {error}
            </p>
            {showCountdown && retryAfter && (
              <div className="mt-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Waktu tunggu: <CountdownTimer
                    seconds={retryAfter}
                    onComplete={handleCountdownComplete}
                    className="text-amber-700 dark:text-amber-300"
                  />
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 ${className}`}>
      <div className="flex items-start gap-3">
        <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {error}
          </p>
        </div>
      </div>
    </div>
  )
}