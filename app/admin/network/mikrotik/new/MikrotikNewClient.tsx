"use client"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TestConnectionModal from '@/components/mikrotik/TestConnectionModal'
import ScriptGeneratorModal from '@/components/mikrotik/ScriptGeneratorModal'
import { Button } from '@/components/ui/Button'

interface TestConnectionResult {
  success: boolean
  api: { success: boolean; message: string }
  ping?: { success: boolean; message: string }
  routerInfo?: {
    identity?: string
    version?: string
    boardName?: string
    uptime?: string
    userOnline?: number
  }
  message: string
}

export function ClientComponent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [pppConnectionMode, setPppConnectionMode] = useState<'RADIUS' | 'MIKROTIK_API'>('RADIUS')
  // RADIUS config (otomatis dari server env, tidak ditampilkan ke user)
  const [radiusDefaults, setRadiusDefaults] = useState({ authPort: 1812, accountingPort: 1813, radiusSecret: 'testing123' })
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    timezone: '+07:00 Asia/Jakarta',
    apiPort: 8728,
    apiUsername: '',
    apiPassword: '',
    isolirUrl: '',
    description: '',
    autoConfigure: true,
  })

  // Fetch settings to know connection mode + RADIUS default ports
  useEffect(() => {
    // Fetch connection mode
    fetch('/api/settings/general')
      .then(res => res.json())
      .then(response => {
        const data = response.data
        if (data && data.pppConnectionMode) setPppConnectionMode(data.pppConnectionMode)
      })
      .catch(console.error)

    // Fetch RADIUS defaults dari env server (untuk ScriptGeneratorModal)
    fetch('/api/settings/radius-defaults')
      .then(res => res.json())
      .then(defaults => {
        setRadiusDefaults({
          authPort: defaults.authPort || 1812,
          accountingPort: defaults.accountingPort || 1813,
          radiusSecret: defaults.radiusSecret || 'testing123',
        })
      })
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasi: test koneksi harus berhasil terlebih dahulu
    if (!testPassed) {
      alert('Silakan test koneksi terlebih dahulu dan pastikan test berhasil sebelum menyimpan router.')
      return
    }
    
    setLoading(true)

    try {
      const res = await fetch('/api/mikrotik-routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menambahkan router')
        return
      }

      router.push('/admin/network/mikrotik')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
      console.error('Error creating router:', error)
      alert('Terjadi kesalahan saat menambahkan router: ' + errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!formData.ipAddress) {
      alert('IP Address harus diisi terlebih dahulu')
      return
    }

    if (!formData.apiUsername || !formData.apiPassword) {
      alert('Username API dan Password API harus diisi untuk test koneksi')
      return
    }

    setIsTesting(true)
    setShowTestModal(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/mikrotik-routers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: formData.ipAddress,
          apiPort: formData.apiPort,
          apiUsername: formData.apiUsername,
          apiPassword: formData.apiPassword,
        }),
      })

      const result = await res.json()
      setTestResult(result)
      // Set testPassed hanya jika test berhasil
      setTestPassed(result.success === true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
      console.error('Error testing connection:', error)
      setTestResult({
        success: false,
        ping: { success: false, message: 'Error: ' + errorMessage },
        api: { success: false, message: 'Error: ' + errorMessage },
        message: 'Terjadi kesalahan saat test koneksi',
      })
      setTestPassed(false)
    } finally {
      setIsTesting(false)
    }
  }


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tambah Router {pppConnectionMode === 'RADIUS' && '[NAS]'}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="success">
            Panduan Dasar
          </Button>
          <Button type="button"
            onClick={() => setShowScriptModal(true)}
          >
            &lt;/&gt; SCRIPT GENERATOR
          </Button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        
        {/* Nama Router */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Nama Router
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Masukkan nama router"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Zona Waktu */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Zona Waktu
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="+07:00 Asia/Jakarta">+07:00 Asia/Jakarta</option>
            <option value="+08:00 Asia/Makassar">+08:00 Asia/Makassar</option>
            <option value="+09:00 Asia/Jayapura">+09:00 Asia/Jayapura</option>
          </select>
        </div>

        {/* IP Router */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! IP Router
          </label>
          <input
            type="text"
            value={formData.ipAddress}
            onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
            required
            placeholder="Masukkan IP Address atau domain"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Port API */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Port API
          </label>
          <input
            type="number"
            value={formData.apiPort}
            onChange={(e) => setFormData({ ...formData, apiPort: parseInt(e.target.value) || 8728 })}
            required
            placeholder="8728"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="65535"
          />
        </div>

        {/* Username API */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Username API
          </label>
          <input
            type="text"
            value={formData.apiUsername}
            onChange={(e) => setFormData({ ...formData, apiUsername: e.target.value })}
            required
            placeholder="Username API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Password API */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Password API
          </label>
          <input
            type="password"
            value={formData.apiPassword}
            onChange={(e) => setFormData({ ...formData, apiPassword: e.target.value })}
            required
            placeholder="Password API"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* URL Info Isolir (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            URL Info Isolir (Optional)
          </label>
          <input
            type="text"
            value={formData.isolirUrl}
            onChange={(e) => setFormData({ ...formData, isolirUrl: e.target.value })}
            placeholder="mydomain.com/expired.html"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PATH URL LENGKAP TANPA HTTP:// ATAU HTTPS://
          </p>
          <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
            <li>FITUR INI DIGUNAKAN UNTUK MENGALIHKAN AKSES PELANGGAN PPPOE YANG TERISOLIR</li>
            <li>PASTIKAN FILE HTML INFORMASI ISOLIR SUDAH ADA DAN BISA DIAKSES OLEH MIKROTIK</li>
            <li>SETELAH FORM INI DISIMPAN, WEB PROXY MIKROTIK HARUS DIENABLE SECARA MANUAL</li>
            <li>
              BACA PANDUAN DI GRUP FACEBOOK{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                MIXRADIUS
              </a>
            </li>
          </ul>
        </div>



        {/* Deskripsi */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Deskripsi
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Deskripsi"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || !testPassed}
            className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!testPassed ? 'Silakan test koneksi terlebih dahulu dan pastikan test berhasil' : ''}
          >
            <span className="text-white">{loading ? 'Menyimpan...' : 'Tambahkan Router'}</span>
          </button>
          <button
            type="button"
            onClick={handleTestConnection}
            className="px-6 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Tes Koneksi
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Or</span>
          <Link
            href="/admin/network/mikrotik"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Batal
          </Link>
        </div>
      </form>

      {/* Test Connection Modal */}
      <TestConnectionModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        result={testResult}
        isLoading={isTesting}
      />

      {/* Script Generator Modal */}
      <ScriptGeneratorModal
        open={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        secret={radiusDefaults.radiusSecret}
      />
    </div>
  )
}

