"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiExclamationCircle, HiEye, HiEyeSlash, HiCloudArrowUp, HiShieldCheck } from 'react-icons/hi2'

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

// Captcha Settings Section Component
function CaptchaSettingsSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [captchaEnabled, setCaptchaEnabled] = useState(false)
  const [siteKey, setSiteKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCaptchaSettings()
  }, [])

  const loadCaptchaSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/captcha')
      if (res.ok) {
        const json = await res.json()
        const data = json.data || {}
        setCaptchaEnabled(data.enabled || false)
        setSiteKey(data.siteKey || '')
        setSecretKey(data.secretKey || '')
      }
    } catch (err) {
      console.error('Failed to load captcha settings', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const res = await fetch('/api/settings/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: captchaEnabled, siteKey, secretKey })
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (_err) {
      setError('Gagal menyimpan pengaturan Captcha')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center gap-2">
          <HiArrowPath className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Memuat pengaturan Captcha...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <HiShieldCheck className="w-5 h-5 text-green-500" />
          Cloudflare Turnstile Captcha
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={captchaEnabled}
            onChange={(e) => setCaptchaEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {captchaEnabled ? 'Aktif' : 'Nonaktif'}
          </span>
        </label>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Lindungi formulir pendaftaran dari spam dengan Cloudflare Turnstile.
        Dapatkan kredensial di{' '}
        <a
          href="https://dash.cloudflare.com/?to=/:account/turnstile"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Cloudflare Dashboard
        </a>.
      </p>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!captchaEnabled ? 'opacity-50' : ''}`}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Site Key
          </label>
          <input
            type="text"
            value={siteKey}
            onChange={(e) => setSiteKey(e.target.value)}
            placeholder="0x4AAAAAA..."
            disabled={!captchaEnabled}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Secret Key
          </label>
          <div className="relative">
            <input
              type={showSecretKey ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="0x4AAAAAA..."
              disabled={!captchaEnabled}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showSecretKey ? <HiEyeSlash className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
          <HiCheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-400">Pengaturan Captcha disimpan!</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
          <HiExclamationCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? <HiArrowPath className="w-4 h-4 animate-spin" /> : <HiCheckCircle className="w-4 h-4" />}
        Simpan Pengaturan Captcha
      </button>
    </div>
  )
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
    } catch (err: unknown) {
      console.error('Error testing API key:', err)
      setError(err instanceof Error ? err.message : 'API Key tidak valid atau terjadi kesalahan')
    } finally {
      setSaving(false)
    }
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
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Google Gemini API */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Google Gemini API
                </h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="geminiEnabled"
                    checked={settings.geminiEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {settings.geminiEnabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </label>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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

              <div className={`space-y-2 ${!settings.geminiEnabled ? 'opacity-50' : ''}`}>
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
                    disabled={!settings.geminiEnabled}
                    placeholder="Masukkan API Key Google Gemini"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-28 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
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
                      disabled={saving || !settings.googleGeminiApiKey.trim() || !settings.geminiEnabled}
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

            {/* Cloudflare R2 Storage */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiCloudArrowUp className="w-5 h-5 text-orange-500" />
                    Cloudflare R2 Storage
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="r2Enabled"
                      checked={settings.r2Enabled}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {settings.r2Enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </label>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-4">
                  Gunakan Cloudflare R2 untuk menyimpan file upload (gambar, dokumen). Jika dinonaktifkan, file akan disimpan di local storage.
                  Dapatkan kredensial R2 di{' '}
                  <a
                    href="https://dash.cloudflare.com/?to=/:account/r2/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Cloudflare Dashboard
                  </a>
                  .
                </p>
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!settings.r2Enabled ? 'opacity-50' : ''}`}>
                <div className="space-y-2">
                  <label htmlFor="r2AccountId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Account ID
                  </label>
                  <input
                    id="r2AccountId"
                    name="r2AccountId"
                    type="text"
                    value={settings.r2AccountId}
                    onChange={handleChange}
                    disabled={!settings.r2Enabled}
                    placeholder="Cloudflare Account ID"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="r2BucketName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bucket Name
                  </label>
                  <input
                    id="r2BucketName"
                    name="r2BucketName"
                    type="text"
                    value={settings.r2BucketName}
                    onChange={handleChange}
                    disabled={!settings.r2Enabled}
                    placeholder="nama-bucket-anda"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="r2AccessKeyId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Access Key ID
                  </label>
                  <input
                    id="r2AccessKeyId"
                    name="r2AccessKeyId"
                    type="text"
                    value={settings.r2AccessKeyId}
                    onChange={handleChange}
                    disabled={!settings.r2Enabled}
                    placeholder="R2 Access Key ID"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="r2SecretAccessKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Secret Access Key
                  </label>
                  <div className="relative">
                    <input
                      id="r2SecretAccessKey"
                      name="r2SecretAccessKey"
                      type={showR2Secret ? 'text' : 'password'}
                      value={settings.r2SecretAccessKey}
                      onChange={handleChange}
                      disabled={!settings.r2Enabled}
                      placeholder="R2 Secret Access Key"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowR2Secret(!showR2Secret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showR2Secret ? (
                        <HiEyeSlash className="w-5 h-5" />
                      ) : (
                        <HiEye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className={`space-y-2 ${!settings.r2Enabled ? 'opacity-50' : ''}`}>
                <label htmlFor="r2PublicUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Public URL (Opsional)
                </label>
                <input
                  id="r2PublicUrl"
                  name="r2PublicUrl"
                  type="text"
                  value={settings.r2PublicUrl}
                  onChange={handleChange}
                  disabled={!settings.r2Enabled}
                  placeholder="https://cdn.example.com atau https://xxxx.r2.dev"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Custom domain atau R2.dev URL untuk akses publik file. Biarkan kosong untuk menggunakan URL default R2.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleTestR2Connection}
                  disabled={testing || !settings.r2AccountId.trim() || !settings.r2AccessKeyId.trim() || !settings.r2BucketName.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testing ? (
                    <>
                      <HiArrowPath className="w-4 h-4 animate-spin" />
                      Menguji Koneksi...
                    </>
                  ) : (
                    <>
                      <HiCloudArrowUp className="w-4 h-4" />
                      Test Koneksi R2
                    </>
                  )}
                </button>
              </div>

              {testSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                  <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">
                    Koneksi ke Cloudflare R2 berhasil!
                  </p>
                </div>
              )}
            </div>

            {/* Cloudflare Turnstile Captcha */}
            <CaptchaSettingsSection />

            {/* Messages */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">
                    Pengaturan berhasil disimpan
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
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
