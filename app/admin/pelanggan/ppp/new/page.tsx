"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiArrowPath, HiArrowDownTray, HiEye, HiEyeSlash } from 'react-icons/hi2'

type HargaPaket = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  profilePPP?: {
    id: string
    name: string
  } | null
  bandwidth?: {
    id: string
    name: string
  } | null
}

export default function PelangganPPPNewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([])
  const [idPelangganError, setIdPelangganError] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState(false)
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)

  const [formData, setFormData] = useState({
    idPelanggan: '',
    nama: '',
    username: '',
    password: '12345', // Default password PPPoE
    passwordLogin: '12345', // Default password untuk login portal pelanggan
    hargaPaketId: '',
    tipe: 'REGULER' as 'REGULER' | 'NON_REGULER',
    tanggalAktif: new Date().toISOString().split('T')[0], // Default: hari ini
    jatuhTempo: '',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE',
    alamat: '',
    noTelp: '',
    email: '',
    catatan: '',
  })

  // Generate ID pelanggan otomatis (angka unik 8 digit) - sync version (fallback)
  const generateIdPelangganSync = () => {
    const now = new Date()
    // Menggunakan beberapa digit terakhir dari timestamp + random untuk memastikan unik
    const timestamp = now.getTime() // Timestamp dalam milidetik
    const timestampStr = String(timestamp)
    // Ambil 5 digit terakhir dari timestamp (unik per detik/menit)
    const timestampPart = timestampStr.slice(-5)
    // Random 3 digit untuk memastikan tidak duplikat
    const random = Math.floor(Math.random() * 1000) // Random 0-999
    // Format: 5 digit timestamp + 3 digit random = 8 digit (contoh: 68001234)
    return timestampPart + String(random).padStart(3, '0')
  }

  // Generate ID pelanggan dari API (async)
  const generateIdPelanggan = async () => {
    try {
      const res = await fetch('/api/pelanggan-ppp/generate-id')
      if (res.ok) {
        const data = await res.json()
        if (data.idPelanggan) {
          return data.idPelanggan
        }
      }
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync()
    } catch (error) {
      console.error('Error generating ID:', error)
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync()
    }
  }

  // Load atau generate ID pelanggan yang terjamin unik dari API
  const loadOrGenerateIdPelanggan = async () => {
    try {
      // Panggil API untuk generate ID yang terjamin unik
      const res = await fetch('/api/pelanggan-ppp/generate-id')
      if (res.ok) {
        const data = await res.json()
        if (data.idPelanggan) {
          return data.idPelanggan
        }
      }
      
      // Fallback: generate di frontend jika API error
      console.warn('API generate-id tidak tersedia, menggunakan fallback')
      return generateIdPelangganSync()
    } catch (error) {
      // Fallback: generate di frontend jika API error
      console.warn('Error memanggil API generate-id:', error)
      return generateIdPelangganSync()
    }
  }

  useEffect(() => {
    // Generate ID pelanggan otomatis saat component mount
    loadOrGenerateIdPelanggan().then((id) => {
      setFormData((prev) => ({
        ...prev,
        idPelanggan: id,
        username: id, // Set username sama dengan ID pelanggan secara default
      }))
    })
    loadHargaPakets()
  }, [])

  const loadHargaPakets = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/hargapakets?status=AKTIF')
      if (res.ok) {
        const data = await res.json()
        setHargaPakets(data || [])
      }
    } catch (err: any) {
      console.error('Error loading harga pakets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validasi
    if (!formData.idPelanggan.trim()) {
      setError('ID Pelanggan harus diisi')
      return
    }
    if (!/^\d{8}$/.test(formData.idPelanggan.trim())) {
      setError('ID Pelanggan harus 8 digit angka')
      return
    }
    if (idPelangganError) {
      setError(idPelangganError)
      return
    }
    if (!formData.nama.trim()) {
      setError('Nama pelanggan harus diisi')
      return
    }
    if (!formData.username.trim()) {
      setError('Username PPPoE harus diisi')
      return
    }
    if (!formData.password.trim()) {
      setError('Password PPPoE harus diisi')
      return
    }
    if (!formData.passwordLogin.trim()) {
      setError('Password Login Portal harus diisi')
      return
    }
    if (!formData.hargaPaketId) {
      setError('Harga Paket harus dipilih')
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/pelanggan-ppp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        // Jika error karena ID duplikat, generate ID baru dan retry
        if (errorData.error?.includes('sudah digunakan') || errorData.error?.includes('unique') || res.status === 409) {
          const newId = await generateIdPelanggan()
          setFormData(prev => ({ ...prev, idPelanggan: newId }))
          setError('ID Pelanggan sudah digunakan. ID baru telah di-generate. Silakan submit ulang.')
          return
        }
        throw new Error(errorData.error || 'Gagal menyimpan pelanggan PPP')
      }

      // Berhasil, redirect ke halaman list
      router.push('/admin/pelanggan/ppp')
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSubmitting(false)
    }
  }

  // Hitung jatuh tempo berdasarkan tanggal aktif dan durasi paket
  const calculateJatuhTempo = useCallback((tanggalAktif: string, hargaPaketId: string) => {
    if (!tanggalAktif || !hargaPaketId || hargaPakets.length === 0) {
      return ''
    }

    const selectedPaket = hargaPakets.find((p) => p.id === hargaPaketId)
    if (!selectedPaket) {
      return ''
    }

    const startDate = new Date(tanggalAktif)
    const jatuhTempo = new Date(startDate)

    // Tambahkan durasi berdasarkan unit
    switch (selectedPaket.durasiUnit) {
      case 'JAM':
        jatuhTempo.setHours(jatuhTempo.getHours() + selectedPaket.durasi)
        break
      case 'HARI':
        jatuhTempo.setDate(jatuhTempo.getDate() + selectedPaket.durasi)
        break
      case 'BULAN':
        jatuhTempo.setMonth(jatuhTempo.getMonth() + selectedPaket.durasi)
        break
      case 'TAHUN':
        jatuhTempo.setFullYear(jatuhTempo.getFullYear() + selectedPaket.durasi)
        break
    }

    return jatuhTempo.toISOString().split('T')[0]
  }, [hargaPakets])

  // Cek apakah ID Pelanggan sudah ada (untuk validasi duplikat)
  const checkIdPelangganExists = async (id: string) => {
    if (!id || id.trim() === '') {
      setIdPelangganError(null)
      return false
    }

    try {
      setCheckingId(true)
      const res = await fetch(`/api/pelanggan-ppp/check-id?idPelanggan=${encodeURIComponent(id)}`)
      if (res.ok) {
        const data = await res.json()
        return data.exists === true
      }
      // Jika error, anggap ID belum ada (untuk menghindari false positive)
      return false
    } catch (error) {
      console.error('Error checking ID pelanggan:', error)
      return false
    } finally {
      setCheckingId(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      
      // Jika yang berubah adalah tanggal aktif atau harga paket, hitung ulang jatuh tempo
      if (name === 'tanggalAktif' || name === 'hargaPaketId') {
        updated.jatuhTempo = calculateJatuhTempo(
          name === 'tanggalAktif' ? value : updated.tanggalAktif,
          name === 'hargaPaketId' ? value : updated.hargaPaketId
        )
      }
      
      // Jika ID Pelanggan berubah, update username juga jika masih sama dengan ID lama
      if (name === 'idPelanggan') {
        if (prev.username === prev.idPelanggan) {
          updated.username = value
        }
        // Reset error saat user mengetik
        setIdPelangganError(null)
      }
      
      return updated
    })
  }

  // Validasi ID Pelanggan dengan debounce
  useEffect(() => {
    const idValue = formData.idPelanggan.trim()
    
    // Validasi format (harus 8 digit angka)
    if (idValue && !/^\d{8}$/.test(idValue)) {
      setIdPelangganError('ID Pelanggan harus 8 digit angka')
      return
    }

    // Cek duplikat dengan debounce
    if (!idValue) {
      setIdPelangganError(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      const exists = await checkIdPelangganExists(idValue)
      if (exists) {
        setIdPelangganError('ID Pelanggan sudah digunakan, silakan gunakan ID lain')
      } else {
        setIdPelangganError(null)
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.idPelanggan])

  // Update jatuh tempo saat harga paket atau tanggal aktif berubah
  useEffect(() => {
    if (formData.tanggalAktif && formData.hargaPaketId && hargaPakets.length > 0) {
      const jatuhTempo = calculateJatuhTempo(formData.tanggalAktif, formData.hargaPaketId)
      if (jatuhTempo) {
        setFormData((prev) => ({ ...prev, jatuhTempo }))
      }
    }
  }, [formData.hargaPaketId, formData.tanggalAktif, calculateJatuhTempo])

  return (
    <div className="w-full max-w-3xl space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tambah Pelanggan PPP</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tambah pelanggan baru dengan koneksi PPPoE
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Tipe Pelanggan */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Tipe Pelanggan
            </h3>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipe Pelanggan <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, tipe: 'REGULER' }))}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.tipe === 'REGULER'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">📅</span>
                    <span className="font-medium">Reguler</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, tipe: 'NON_REGULER' }))}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.tipe === 'NON_REGULER'
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-lg">🔄</span>
                    <span className="font-medium">Non Reguler</span>
                  </div>
                </button>
              </div>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-1">
                  {formData.tipe === 'REGULER' ? '📅 Reguler' : '🔄 Non Reguler'}
                </p>
                <p className="text-xs text-blue-800 dark:text-blue-400">
                  {formData.tipe === 'REGULER' ? (
                    <>
                      Jika pelanggan sudah lewat jatuh tempo, masa aktif akan <strong>dikurangi</strong> sesuai dengan jatuh tempo saat daftar. 
                      Tanggal aktif akan mundur untuk menyesuaikan dengan keterlambatan pembayaran.
                    </>
                  ) : (
                    <>
                      Jika jatuh tempo lewat, masa aktif akan <strong>tetap bertambah</strong> sesuai paket. 
                      Tanggal jatuh tempo akan <strong>ikut berubah</strong> (diperpanjang) secara otomatis.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Data Dasar */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Data Dasar
            </h3>

            <div className="space-y-2">
              <label htmlFor="idPelanggan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ID Pelanggan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="idPelanggan"
                  name="idPelanggan"
                  type="text"
                  required
                  value={formData.idPelanggan}
                  onChange={handleChange}
                  maxLength={8}
                  pattern="[0-9]{8}"
                  className={`w-full rounded-lg border ${
                    idPelangganError
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    idPelangganError
                      ? 'focus:ring-red-500'
                      : 'focus:ring-indigo-500'
                  } focus:border-transparent transition-colors`}
                  placeholder="8 digit angka (otomatis atau manual)"
                />
                {checkingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <HiArrowPath className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {idPelangganError ? (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {idPelangganError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  ID pelanggan otomatis di-generate (8 digit), bisa diubah manual. Pastikan ID unik dan tidak duplikat.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nama Pelanggan <span className="text-red-500">*</span>
              </label>
              <input
                id="nama"
                name="nama"
                type="text"
                required
                value={formData.nama}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Nama lengkap pelanggan"
              />
            </div>
          </div>

          {/* Kredensial PPPoE */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Kredensial PPPoE
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username PPPoE <span className="text-red-500">*</span>
                </label>
                {formData.username !== formData.idPelanggan && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, username: prev.idPelanggan }))}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    Gunakan ID Pelanggan
                  </button>
                )}
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="username@domain atau sama dengan ID Pelanggan"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: sama dengan ID Pelanggan ({formData.idPelanggan}), bisa diubah manual jika diperlukan
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password PPPoE <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Password untuk koneksi PPPoE"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: 12345, bisa diubah manual jika diperlukan. Password ini digunakan untuk koneksi PPPoE.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="passwordLogin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password Login Portal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="passwordLogin"
                  name="passwordLogin"
                  type={showPasswordLogin ? 'text' : 'password'}
                  required
                  value={formData.passwordLogin}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Password untuk login portal pelanggan"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPasswordLogin ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPasswordLogin ? (
                    <HiEyeSlash className="w-5 h-5" />
                  ) : (
                    <HiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: 12345, bisa diubah manual jika diperlukan. Password ini digunakan untuk login di portal pelanggan (/pelanggan/login).
              </p>
            </div>
          </div>

          {/* Paket & Tanggal */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Paket & Tanggal
            </h3>

            <div className="space-y-2">
              <label htmlFor="hargaPaketId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Harga Paket <span className="text-red-500">*</span>
              </label>
              <select
                id="hargaPaketId"
                name="hargaPaketId"
                required
                value={formData.hargaPaketId}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">-- Pilih Harga Paket --</option>
                {hargaPakets.map((paket) => {
                  const hargaFormatted = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                  }).format(paket.harga)
                  const durasiText = `${paket.durasi} ${paket.durasiUnit.toLowerCase()}`
                  return (
                    <option key={paket.id} value={paket.id}>
                      {paket.name} - {hargaFormatted} / {durasiText}
                    </option>
                  )
                })}
              </select>
              {formData.hargaPaketId && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(() => {
                    const selectedPaket = hargaPakets.find((p) => p.id === formData.hargaPaketId)
                    if (selectedPaket) {
                      return `Profile PPP: ${selectedPaket.profilePPP?.name || 'Tidak ada'} | Bandwidth: ${selectedPaket.bandwidth?.name || 'Tidak ada'}`
                    }
                    return ''
                  })()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tanggalAktif" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tanggal Aktif <span className="text-red-500">*</span>
                </label>
                <input
                  id="tanggalAktif"
                  name="tanggalAktif"
                  type="date"
                  required
                  value={formData.tanggalAktif}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="jatuhTempo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jatuh Tempo <span className="text-red-500">*</span>
                </label>
                <input
                  id="jatuhTempo"
                  name="jatuhTempo"
                  type="date"
                  required
                  value={formData.jatuhTempo}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Jatuh tempo dihitung otomatis, namun bisa diubah manual jika diperlukan
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="status"
                name="status"
                required
                value={formData.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>

          {/* Informasi Kontak */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Informasi Kontak
            </h3>

            <div className="space-y-2">
              <label htmlFor="alamat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Alamat
              </label>
              <textarea
                id="alamat"
                name="alamat"
                rows={3}
                value={formData.alamat}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Alamat lengkap pelanggan"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="noTelp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  No. Telepon
                </label>
                <input
                  id="noTelp"
                  name="noTelp"
                  type="text"
                  value={formData.noTelp}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="081234567890"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Catatan
            </h3>

            <div className="space-y-2">
              <label htmlFor="catatan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Catatan Tambahan
              </label>
              <textarea
                id="catatan"
                name="catatan"
                rows={4}
                value={formData.catatan}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Catatan atau keterangan tambahan tentang pelanggan"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={submitting || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <HiArrowDownTray className="w-4 h-4" />
                  Simpan
                </>
              )}
            </button>
            <Link
              href="/admin/pelanggan/ppp"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

