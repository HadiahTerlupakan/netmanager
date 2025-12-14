"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Olt = {
  id: string
  name: string
}

export default function OnuTypeNewPage() {
  const router = useRouter()
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [name, setName] = useState('')
  const [ethernetPorts, setEthernetPorts] = useState<number>(0)
  const [wifi, setWifi] = useState<number>(0)
  const [voipPorts, setVoipPorts] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [loadingOlts, setLoadingOlts] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOlts()
  }, [])

  const loadOlts = async () => {
    try {
      setLoadingOlts(true)
      setError(null)
      const res = await fetch('/api/olts')

      if (!res.ok) {
        // Jika unauthorized, mungkin session expired
        if (res.status === 401) {
          setError('Session expired. Silakan refresh halaman dan login kembali.')
          return
        }

        const errorData = await res.json().catch(() => ({}))
        console.error('Error response:', errorData)
        // Tetap coba set data jika ada, meskipun ada error
        if (errorData.olts && Array.isArray(errorData.olts)) {
          setOlts(errorData.olts)
        } else {
          throw new Error(errorData.error || `Gagal memuat data OLT: ${res.status}`)
        }
        return
      }

      const data = await res.json()
      const oltList = data.olts || []
      console.log('Loaded OLTs:', oltList.length, 'items')
      console.log('OLT Data:', oltList)

      // Pastikan data adalah array dan memiliki struktur yang benar
      if (Array.isArray(oltList) && oltList.length > 0) {
        // Validasi setiap item memiliki id dan name
        const validOlts = oltList.filter((olt: any) => olt && olt.id && olt.name)
        console.log('Valid OLTs:', validOlts.length)
        setOlts(validOlts)

        if (validOlts.length === 0) {
          setError('Data OLT tidak valid. Silakan refresh halaman.')
        } else {
          // Clear error jika berhasil load data
          setError(null)
        }
      } else {
        console.warn('No OLTs found or invalid data structure')
        setOlts([])
        setError('Tidak ada OLT yang tersedia. Silakan tambahkan OLT terlebih dahulu.')
      }
    } catch (e: any) {
      console.error('Error loading OLTs:', e)
      setError(e.message || 'Gagal memuat data OLT. Silakan refresh halaman.')
    } finally {
      setLoadingOlts(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedOltId) {
      setError('Pilih OLT terlebih dahulu')
      return
    }

    if (!name.trim()) {
      setError('Nama ONU Type harus diisi')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/onutypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oltId: selectedOltId,
          name: name.trim(),
          ethernetPorts,
          wifi,
          voipPorts,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Gagal menyimpan OnuType')
      }

      router.push('/admin/network/onutype')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <Link href="/admin/network/onutype" className="hover:text-gray-700 dark:hover:text-gray-300">
          Type
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">New</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Onu Type</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Isi data Onu Type untuk OLT yang dipilih.</p>
        </div>
      </div>

      {/* OLT Selection - Card terpisah seperti di halaman VLAN */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">Pilih OLT</label>
        {loadingOlts ? (
          <div className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            Memuat data OLT...
          </div>
        ) : (
          <select
            value={selectedOltId}
            onChange={(e) => {
              console.log('OLT selected:', e.target.value)
              setSelectedOltId(e.target.value)
            }}
            required
            disabled={olts.length === 0}
            className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          >
            <option value="">-- Pilih OLT --</option>
            {olts.length > 0 ? (
              olts.map((olt) => (
                <option key={olt.id} value={olt.id}>
                  {olt.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                Tidak ada OLT tersedia
              </option>
            )}
          </select>
        )}
        {!loadingOlts && olts.length === 0 && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Tidak ada OLT yang tersedia.</strong> Silakan tambahkan OLT terlebih dahulu di halaman{' '}
              <Link href="/admin/network/olt" className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300">
                OLT Management
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {/* Form Data OnuType - hanya muncul jika OLT sudah dipilih */}
      {selectedOltId && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Nama ONU Type <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="Contoh: ZTE, H640GW, HG8245H"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Ethernet Ports</label>
                <input
                  type="number"
                  min={0}
                  value={ethernetPorts}
                  onChange={(e) => setEthernetPorts(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Wifi</label>
                <input
                  type="number"
                  min={0}
                  value={wifi}
                  onChange={(e) => setWifi(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">VoIP Ports</label>
                <input
                  type="number"
                  min={0}
                  value={voipPorts}
                  onChange={(e) => setVoipPorts(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Pesan jika OLT belum dipilih */}
      {!selectedOltId && !loadingOlts && olts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pilih OLT terlebih dahulu untuk menambahkan Onu Type</p>
        </div>
      )}
    </div>
  )
}

