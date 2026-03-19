"use client"

import { Globe, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone-constants'

type TimezoneSettingsProps = {
  timezone: string
  currentTime: string
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export function TimezoneSettings({
  timezone,
  currentTime,
  handleChange
}: TimezoneSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-500" />
          Zona Waktu Aplikasi
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Zona waktu ini akan digunakan untuk semua jadwal otomatis (cron job) seperti generate tagihan, sync OLT/ONU, dll.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live Clock Preview */}
        <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
          <div className="p-2 bg-white dark:bg-indigo-900/40 rounded-lg shadow-sm">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-wider">
              Waktu saat ini di zona {timezone}:
            </p>
            <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {currentTime || 'Memuat...'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
