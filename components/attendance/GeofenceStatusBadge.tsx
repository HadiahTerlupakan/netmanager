'use client'

import { FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa'

interface GeofenceStatusBadgeProps {
  status: 'INSIDE' | 'OUTSIDE' | 'UNKNOWN'
  distance?: number | null
  siteName?: string | null
}

export function GeofenceStatusBadge({
  status,
  distance,
  siteName
}: GeofenceStatusBadgeProps) {
  if (status === 'UNKNOWN') {
    return null
  }
  
  const isInside = status === 'INSIDE'
  
  return (
    <div className={`p-3 rounded-lg border ${
      isInside 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30' 
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900/30'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-full ${
          isInside 
            ? 'bg-green-100 dark:bg-green-500/20' 
            : 'bg-yellow-100 dark:bg-yellow-500/20'
        }`}>
          {isInside ? (
            <FaCheckCircle className="text-green-600 dark:text-green-400" size={20} />
          ) : (
            <FaExclamationTriangle className="text-yellow-600 dark:text-yellow-400" size={20} />
          )}
        </div>
        
        <div className="flex-1">
          <p className={`text-sm font-medium ${
            isInside 
              ? 'text-green-700 dark:text-green-300' 
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            {isInside ? 'Di dalam zona kantor' : 'Di luar zona kantor'}
          </p>
          {siteName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {siteName}
            </p>
          )}
          {distance !== null && !isInside && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Jarak: {distance}m dari zona
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
