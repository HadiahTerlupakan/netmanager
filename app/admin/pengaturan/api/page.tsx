"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiExclamationCircle, HiEye, HiEyeSlash } from 'react-icons/hi2'

type ApiSettings = {
  googleGeminiApiKey: string
}

export default function ApiSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [settings, setSettings] = useState<ApiSettings>({
    googleGeminiApiKey: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/settings/api')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          googleGeminiApiKey: data.googleGeminiApiKey || '',
        })
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Gagal memuat pengaturan')
      }
    } catch (err: any) {
      console.error('Error loading settings:', err)
      setError(err.message || 'Terjadi kesalahan saat memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      setSaving(true)
      const res = await fetch('/api/settings/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan pengaturan')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message || 'Terjadi kesalahan saat menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(false)
  }

  const handleTestApiKey = async () => {
    if (!settings.googleGeminiApiKey.trim()) {
      setError('Silakan masukkan API Key terlebih dahulu')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const res = await fetch('/api/settings/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.googleGeminiApiKey }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'API Key tidak valid')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error testing API key:', err)
      setError(err.message || 'API Key tidak valid atau terjadi kesalahan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pengaturan API</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola konfigurasi API untuk integrasi dengan layanan eksternal
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Memuat pengaturan...</span>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Google Gemini API */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                  Google Gemini API
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  API Key untuk Google Gemini digunakan untuk fitur OCR KTP. Dapatkan API Key di{' '}
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Google AI Studio
                  </a>
                  .
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="googleGeminiApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Google Gemini API Key
                </label>
                <div className="relative">
                  <input
                    id="googleGeminiApiKey"
                    name="googleGeminiApiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.googleGeminiApiKey}
                    onChange={handleChange}
                    placeholder="Masukkan API Key Google Gemini"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-28 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label={showApiKey ? 'Sembunyikan API Key' : 'Tampilkan API Key'}
                    >
                      {showApiKey ? (
                        <HiEyeSlash className="w-5 h-5" />
                      ) : (
                        <HiEye className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestApiKey}
                      disabled={saving || !settings.googleGeminiApiKey.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Menguji...' : 'Uji'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  API Key akan disimpan dengan aman di database. Jika kosong, sistem akan menggunakan API Key dari environment variable (.env).
                </p>
              </div>
            </div>

            {/* Messages */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">
                    Pengaturan berhasil disimpan
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? (
                  <>
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <HiCheckCircle className="w-4 h-4" />
                    Simpan Pengaturan
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={loadSettings}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <HiArrowPath className="w-4 h-4" />
                Muat Ulang
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

