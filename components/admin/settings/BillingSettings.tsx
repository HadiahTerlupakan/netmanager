"use client"

import { Receipt, Bell, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type BillingSettingsProps = {
  settings: {
    invoiceOtomatis: string
    disablePerpanjanganPaket: string
    reminderOtomatis: string
    reminderFrequency: 'ONCE' | 'DAILY'
    reminderTime: string
  }
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

export function BillingSettings({ settings, handleChange }: BillingSettingsProps) {
  const invoiceOtomatisOptions = [
    { value: '1', label: '1 Hari Sebelum Jatuh Tempo' },
    { value: '2', label: '2 Hari Sebelum Jatuh Tempo' },
    { value: '3', label: '3 Hari Sebelum Jatuh Tempo' },
    { value: '4', label: '4 Hari Sebelum Jatuh Tempo' },
    { value: '5', label: '5 Hari Sebelum Jatuh Tempo' },
    { value: '6', label: '6 Hari Sebelum Jatuh Tempo' },
    { value: '7', label: '7 Hari Sebelum Jatuh Tempo' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-500" />
          Penagihan & Reminder
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Atur jadwal pembuatan invoice otomatis dan pengiriman reminder tagihan
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="invoiceOtomatis" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Generate Invoice Otomatis
            </label>
            <select
              id="invoiceOtomatis"
              name="invoiceOtomatis"
              value={settings.invoiceOtomatis}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
            >
              {invoiceOtomatisOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              Invoice (HOTSPOT/PPP) akan dibuat otomatis pada periode yang dipilih.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="disablePerpanjanganPaket" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Batas Perpanjangan Paket
            </label>
            <select
              id="disablePerpanjanganPaket"
              name="disablePerpanjanganPaket"
              value={settings.disablePerpanjanganPaket}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
            >
              {invoiceOtomatisOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4 p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-orange-600" />
            <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-400">Pengaturan Reminder Tagihan</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="reminderOtomatis" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Mulai Kirim (H-X)
              </label>
              <select
                id="reminderOtomatis"
                name="reminderOtomatis"
                value={settings.reminderOtomatis}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <option key={num} value={num.toString()}>
                    {num} Hari Sebelum
                  </option>
                ))}
                <option value="0">Tepat Hari H (H-0)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="reminderFrequency" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Frekuensi
              </label>
              <select
                id="reminderFrequency"
                name="reminderFrequency"
                value={settings.reminderFrequency}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ONCE">Kirim Sekali</option>
                <option value="DAILY">Kirim Tiap Hari</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="reminderTime" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Waktu Pengiriman
            </label>
            <div className="relative w-full md:w-48">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="time"
                id="reminderTime"
                name="reminderTime"
                value={settings.reminderTime}
                onChange={handleChange}
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
