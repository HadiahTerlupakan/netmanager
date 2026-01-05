"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TestConnectionModal from '@/components/mikrotik/TestConnectionModal'
import ScriptGeneratorModal from '@/components/mikrotik/ScriptGeneratorModal'

export function ClientComponent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    timezone: '+07:00 Asia/Jakarta',
    apiPort: 8728,
    apiUsername: '',
    apiPassword: '',
    authPort: 7265,
    accountingPort: 7266,
    secretRadius: Array(20).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join(''),
    isolirUrl: '',
    description: '',
    autoConfigure: true,
  })

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
    } catch (error: any) {
      console.error('Error creating router:', error)
      alert('Terjadi kesalahan saat menambahkan router: ' + (error.message || 'Unknown error'))
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
    } catch (error: any) {
      console.error('Error testing connection:', error)
      setTestResult({
        success: false,
        ping: { success: false, message: 'Error: ' + (error.message || 'Unknown error') },
        api: { success: false, message: 'Error: ' + (error.message || 'Unknown error') },
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Router [NAS]</h1>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            Panduan Dasar
          </button>
          <button 
            type="button"
            onClick={() => setShowScriptModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>&lt;/&gt;</span>
            SCRIPT GENERATOR
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
            Secret ini digenerate otomatis. Pastikan nilai ini SAMA dengan yang dikonfigurasi di menu RADIUS pada MikroTik.
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
            disabled={loading || !testPassed}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!testPassed ? 'Silakan test koneksi terlebih dahulu dan pastikan test berhasil' : ''}
          >
            {loading ? 'Menyimpan...' : 'Tambahkan Router'}
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
    </div>
  )
}

