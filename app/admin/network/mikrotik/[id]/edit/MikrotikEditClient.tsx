"use client"
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TestConnectionModal from '@/components/mikrotik/TestConnectionModal'
import ScriptGeneratorModal from '@/components/mikrotik/ScriptGeneratorModal'
import { HiArrowPath } from 'react-icons/hi2'

export function ClientComponent() {
  const router = useRouter()
  const params = useParams()
  const routerId = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean;
    ping?: { success: boolean; message: string };
    api?: { success: boolean; message: string };
    message?: string;
  } | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    timezone: '+07:00 Asia/Jakarta',
    apiPort: 8728,
    apiUsername: '',
    apiPassword: '',
    authPort: 7265,
    accountingPort: 7266,
    secretRadius: '',
    isolirUrl: '',
    description: '',
  })

  const loadRouter = useCallback(async () => {
    try {
      const res = await fetch(`/api/mikrotik-routers/${routerId}`)
      if (!res.ok) {
        alert('Router tidak ditemukan')
        router.push('/admin/network/mikrotik')
        return
      }
      const data = await res.json()
      const routerData = data.router
      setFormData({
        name: routerData.name,
        ipAddress: routerData.ipAddress,
        timezone: routerData.timezone,
        apiPort: routerData.apiPort,
        apiUsername: routerData.apiUsername,
        apiPassword: routerData.apiPassword,
        authPort: routerData.authPort,
        accountingPort: routerData.accountingPort,
        secretRadius: routerData.secretRadius,
        isolirUrl: routerData.isolirUrl || '',
        description: routerData.description || '',
      })
    } catch (error) {
      console.error('Error loading router:', error)
      alert('Gagal memuat data router')
      router.push('/admin/network/mikrotik')
    } finally {
      setLoading(false)
    }
  }, [routerId, router])

  useEffect(() => {
    loadRouter()
  }, [loadRouter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const res = await fetch(`/api/mikrotik-routers/${routerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal mengupdate router')
        return
      }

      router.push('/admin/network/mikrotik')
    } catch (error) {
      console.error('Error updating router:', error)
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
      alert('Terjadi kesalahan saat mengupdate router: ' + message)
    } finally {
      setSaving(false)
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
          routerId: routerId, // Update status di database jika test berhasil
        }),
      })

      const result = await res.json()
      setTestResult(result)
      
      // Reload router data jika test berhasil untuk update status
      if (result.success) {
        await loadRouter()
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
      setTestResult({
        success: false,
        ping: { success: false, message: 'Error: ' + message },
        api: { success: false, message: 'Error: ' + message },
        message: 'Terjadi kesalahan saat test koneksi',
      })
    } finally {
      setIsTesting(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <HiArrowPath className="mb-4 w-12 h-12 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data router...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Router [NAS]</h1>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-700 dark:hover:bg-green-400 transition-colors">
            <span className="text-white">Panduan Dasar</span>
          </button>
          <button 
            type="button"
            onClick={() => setShowScriptModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
          >
            <span className="text-white">&lt;/&gt;</span>
            <span className="text-white">SCRIPT GENERATOR</span>
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Authentication Port */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Authentication Port
          </label>
          <input
            type="number"
            value={formData.authPort}
            onChange={(e) => setFormData({ ...formData, authPort: parseInt(e.target.value) || 7265 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="65535"
          />
        </div>

        {/* Accounting Port */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Accounting Port
          </label>
          <input
            type="number"
            value={formData.accountingPort}
            onChange={(e) => setFormData({ ...formData, accountingPort: parseInt(e.target.value) || 7266 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="65535"
          />
        </div>

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
            placeholder="192.168.1.1 atau mydomain.com"
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

        {/* Secret Radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ! Secret Radius
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.secretRadius}
              onChange={(e) => setFormData({ ...formData, secretRadius: e.target.value })}
              required
              placeholder="Secret Radius"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let result = '';
                for (let i = 0; i < 20; i++) {
                  result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                setFormData({ ...formData, secretRadius: result });
              }}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Generate Random Secret"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Klik tombol refresh untuk generate secret acak baru. Jangan lupa update juga konfigurasi di MikroTik.
          </p>
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
            disabled={saving}
            className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-white">{saving ? 'Menyimpan...' : 'Update Router'}</span>
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

      <ScriptGeneratorModal
        open={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        secret={formData.secretRadius}
      />
    </div>
  )
}

