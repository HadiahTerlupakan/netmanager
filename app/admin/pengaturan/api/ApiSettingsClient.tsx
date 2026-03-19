"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi2'
import { CaptchaSettings } from '@/components/admin/settings/CaptchaSettings'
import { R2Settings } from '@/components/admin/settings/R2Settings'
import { GeminiSettings } from '@/components/admin/settings/GeminiSettings'

type ApiSettings = {
  googleGeminiApiKey: string
  geminiEnabled: boolean
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicUrl: string
  r2Enabled: boolean
}

export function ClientComponent() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showR2Secret, setShowR2Secret] = useState(false)
  const [settings, setSettings] = useState<ApiSettings>({
    googleGeminiApiKey: '',
    geminiEnabled: false,
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2BucketName: '',
    r2PublicUrl: '',
    r2Enabled: false,
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
        const json = await res.json()
        const data = json.data || {}
        setSettings({
          googleGeminiApiKey: data.googleGeminiApiKey || '',
          geminiEnabled: data.geminiEnabled || false,
          r2AccountId: data.r2AccountId || '',
          r2AccessKeyId: data.r2AccessKeyId || '',
          r2SecretAccessKey: data.r2SecretAccessKey || '',
          r2BucketName: data.r2BucketName || '',
          r2PublicUrl: data.r2PublicUrl || '',
          r2Enabled: data.r2Enabled || false,
        })
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Gagal memuat pengaturan')
      }
    } catch (err: unknown) {
      console.error('Error loading settings:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat pengaturan')
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
    } catch (err: unknown) {
      console.error('Error saving settings:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    setError(null)
    setSuccess(false)
  }

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: checked
    }))
    setError(null)
    setSuccess(false)
  }

  const handleTestR2Connection = async () => {
    if (!settings.r2AccountId.trim() || !settings.r2AccessKeyId.trim() || !settings.r2BucketName.trim()) {
      setError('Silakan isi Account ID, Access Key ID, dan Bucket Name')
      return
    }

    // Check if secret key is a placeholder
    if (settings.r2SecretAccessKey === '********') {
      setError('Silakan masukkan Secret Access Key yang baru untuk test koneksi')
      return
    }

    if (!settings.r2SecretAccessKey.trim()) {
      setError('Silakan masukkan Secret Access Key')
      return
    }

    try {
      setTesting(true)
      setError(null)
      setTestSuccess(false)

      const res = await fetch('/api/settings/api/r2/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: settings.r2AccountId,
          accessKeyId: settings.r2AccessKeyId,
          secretAccessKey: settings.r2SecretAccessKey,
          bucketName: settings.r2BucketName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Koneksi ke R2 gagal')
      }

      setTestSuccess(true)
      setTimeout(() => setTestSuccess(false), 3000)
    } catch (err: unknown) {
      console.error('Error testing R2 connection:', err)
      setError(err instanceof Error ? err.message : 'Koneksi ke R2 gagal')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="mb-4 text-center md:text-left">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan API & Cloud</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola konfigurasi integrasi layanan pihak ketiga, AI, dan penyimpanan cloud
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <HiArrowPath className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Memuat pengaturan API...</span>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <GeminiSettings 
              enabled={settings.geminiEnabled}
              apiKey={settings.googleGeminiApiKey}
              showApiKey={showApiKey}
              setShowApiKey={setShowApiKey}
              handleChange={handleChange}
              handleToggle={handleToggle}
            />

            <R2Settings 
              settings={settings}
              showR2Secret={showR2Secret}
              setShowR2Secret={setShowR2Secret}
              handleChange={handleChange}
              handleToggle={handleToggle}
              handleTestR2={handleTestR2Connection}
              testing={testing}
            />

            <CaptchaSettings />
          </div>

          {/* Feedback & Actions */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                {success && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-left-2">
                    <HiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">Pengaturan API berhasil disimpan!</span>
                  </div>
                )}
                {testSuccess && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 animate-in fade-in slide-in-from-left-2">
                    <HiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">Koneksi R2 Berhasil!</span>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-left-2">
                    <HiExclamationCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{error}</span>
                  </div>
                )}
                {!success && !error && !testSuccess && (
                  <p className="text-xs text-gray-500 font-medium">Perubahan pada API Key mungkin membutuhkan restart service tertentu.</p>
                )}
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={loadSettings}
                  disabled={loading || saving}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  <HiArrowPath className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] md:flex-none inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
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
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
