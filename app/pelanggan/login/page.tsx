"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiArrowPath, HiLockClosed } from 'react-icons/hi2'
import Link from 'next/link'

export default function PelangganLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    idPelanggan: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/pelanggan/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idPelanggan: formData.idPelanggan.trim(),
          password: formData.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'ID Pelanggan atau password salah')
      }

      // Simpan token/session (akan di-handle oleh API)
      if (data.token) {
        // Simpan token di localStorage atau cookie
        localStorage.setItem('pelanggan_token', data.token)
        localStorage.setItem('pelanggan_data', JSON.stringify(data.pelanggan))
      }

      // Redirect ke dashboard pelanggan
      router.push('/pelanggan')
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat login')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">NetManager</h1>
          <p className="text-gray-600 dark:text-gray-400">Portal Pelanggan</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Masuk Sebagai Pelanggan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Gunakan ID Pelanggan dan password Anda untuk masuk
            </p>
          </div>

          <form className="w-full space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="idPelanggan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ID Pelanggan
              </label>
              <input
                id="idPelanggan"
                name="idPelanggan"
                type="text"
                required
                value={formData.idPelanggan}
                onChange={handleChange}
                maxLength={8}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Masukkan ID Pelanggan (8 digit)"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password Login Portal
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Masukkan password login portal"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                <strong>PENTING:</strong> Gunakan Password Login Portal yang di-set saat pendaftaran. 
                Ini berbeda dengan Password PPPoE yang digunakan untuk koneksi internet.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <HiLockClosed className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lupa ID Pelanggan atau password?{' '}
              <Link href="/admin" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Hubungi Admin
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

