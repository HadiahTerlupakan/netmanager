"use client"

import { BellRing, Smartphone, MessageSquare, Mail, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type NotificationSettingsProps = {
  settings: {
    attendanceTolerance: string
    notifApp: boolean
    notifWa: boolean
    notifEmail: boolean
  }
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function NotificationSettings({
  settings,
  handleChange,
  handleCheckboxChange
}: NotificationSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-indigo-500" />
          Notifikasi & Absensi
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Konfigurasi channel notifikasi dan toleransi waktu kerja
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="attendanceTolerance" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Toleransi Keterlambatan Absensi (Menit)
          </label>
          <div className="relative w-full md:w-48">
            <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="attendanceTolerance"
              name="attendanceTolerance"
              type="number"
              min="0"
              max="60"
              value={settings.attendanceTolerance}
              onChange={handleChange}
              placeholder="0"
              className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            0 = Tidak ada toleransi. Check-in setelah jam masuk akan dianggap terlambat.
          </p>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-4">Channel Notifikasi</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="notifApp"
                checked={settings.notifApp}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">App Push</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="notifWa"
                checked={settings.notifWa}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                name="notifEmail"
                checked={settings.notifEmail}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Email</span>
              </div>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
