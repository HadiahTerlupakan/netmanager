"use client"

import { Network, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type NetworkSettingsProps = {
  settings: {
    pppConnectionMode: 'RADIUS' | 'MIKROTIK_API'
  }
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

export function NetworkSettings({ settings, handleChange }: NetworkSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-indigo-500" />
          Jaringan & PPP
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Konfigurasi teknis autentikasi dan koneksi pelanggan
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="pppConnectionMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mode Koneksi PPP
          </label>
          <select
            id="pppConnectionMode"
            name="pppConnectionMode"
            value={settings.pppConnectionMode}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
          >
            <option value="RADIUS">RADIUS - Autentikasi via FreeRADIUS Server</option>
            <option value="MIKROTIK_API">MikroTik API - PPP Secret langsung di Router</option>
          </select>

          <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-400 uppercase tracking-wider">Info Mode</p>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  {settings.pppConnectionMode === 'RADIUS'
                    ? 'Pelanggan diautentikasi melalui FreeRADIUS Server. Seluruh manajemen user terpusat di database RADIUS. Cocok untuk skalabilitas tinggi.'
                    : 'Manajemen user dilakukan langsung dengan membuat/mengupdate PPP Secret di MikroTik melalui API. Cocok untuk jaringan skala kecil tanpa server RADIUS.'}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 pt-1">
                  <strong>Isolir:</strong> Kedua mode mendukung fitur isolir otomatis dengan merubah profile ke profile isolir di MikroTik.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
