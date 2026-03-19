"use client"

import { Cpu, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type GeminiSettingsProps = {
  enabled: boolean
  apiKey: string
  showApiKey: boolean
  setShowApiKey: (show: boolean) => void
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleToggle: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function GeminiSettings({
  enabled,
  apiKey,
  showApiKey,
  setShowApiKey,
  handleChange,
  handleToggle
}: GeminiSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-500" />
              Google Gemini AI
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Integrasi AI untuk asisten cerdas dan analisis data
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="geminiEnabled"
              checked={enabled}
              onChange={handleToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {enabled ? 'Aktif' : 'Nonaktif'}
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`space-y-2 ${!enabled ? 'opacity-50' : ''}`}>
          <label htmlFor="googleGeminiApiKey" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Google Gemini API Key
          </label>
          <div className="relative">
            <input
              id="googleGeminiApiKey"
              name="googleGeminiApiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleChange}
              disabled={!enabled}
              placeholder="Masukkan API Key Gemini"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none pr-10 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dapatkan API Key di <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Google AI Studio</a>. Pastikan Anda menggunakan model <strong>gemini-1.5-flash</strong> atau yang lebih baru.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
