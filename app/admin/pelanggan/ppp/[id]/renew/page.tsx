'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiArrowLeft, HiExclamationCircle } from 'react-icons/hi2'
import Link from 'next/link'
import PageLoader from '@/components/ui/PageLoader'

type Pelanggan = {
  id: string
  idPelanggan: string
  nama: string
  tipe: 'REGULER' | 'NON_REGULER'
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  hargaPaketId: string
  hargaPaket?: {
    id: string
    name: string
    harga: number
  } | null
  jatuhTempo: string
}

type HargaPaket = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
}

type Tagihan = {
  id: string
  noTagihan: string
  total: number
  ppn: number
  status: 'BELUM_LUNAS' | 'LUNAS' | 'TERLAMBAT'
  jatuhTempo: string
}

export default function RenewPelangganPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [pelanggan, setPelanggan] = useState<Pelanggan | null>(null)
  const [tagihanAktif, setTagihanAktif] = useState<Tagihan | null>(null)
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([])
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    hargaPaketId: '', // Optional: untuk ubah paket
    diskon: 0,
    tipeLangganan: 'SEKALI_BELI', // SEKALI_BELI, PERPANJANG
    statusBayar: 'LUNAS',
    statusAkun: 'AKTIF',
    metodePembayaran: 'PEMBAYARAN_MANUAL',
    ownerDataTransaksi: '',
    catatan: '',
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const id = params.id as string

        // Load pelanggan
        const pelangganRes = await fetch(`/api/pelanggan-ppp/${id}`)
        if (!pelangganRes.ok) {
          throw new Error('Gagal memuat data pelanggan')
        }
        const pelangganData = await pelangganRes.json()
        setPelanggan(pelangganData)
        setFormData((prev) => ({
          ...prev,
          hargaPaketId: pelangganData.hargaPaketId || '',
          statusAkun: pelangganData.status || 'AKTIF',
        }))

        // Load tagihan aktif (belum lunas)
        const tagihanRes = await fetch(`/api/tagihan/pelanggan/${id}`)
        if (tagihanRes.ok) {
          const tagihans = await tagihanRes.json()
          const tagihanBelumLunas = tagihans.find(
            (t: Tagihan) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT',
          )
          setTagihanAktif(tagihanBelumLunas || null)
        }

        // Load daftar paket
        const paketRes = await fetch('/api/hargapakets')
        if (paketRes.ok) {
          const pakets = await paketRes.json()
          setHargaPakets(pakets || [])
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const id = params.id as string

      // Jika ubah paket, update paket dulu
      if (formData.hargaPaketId && formData.hargaPaketId !== pelanggan?.hargaPaketId) {
        const updatePaketRes = await fetch(`/api/pelanggan-ppp/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hargaPaketId: formData.hargaPaketId,
          }),
        })

        if (!updatePaketRes.ok) {
          throw new Error('Gagal mengubah paket')
        }
      }

      // Update status pembayaran tagihan jika ada
      if (tagihanAktif && formData.statusBayar === 'LUNAS') {
        const bayarRes = await fetch(`/api/tagihan/${tagihanAktif.id}/bayar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metodePembayaran: formData.metodePembayaran,
            catatan: formData.catatan,
          }),
        })

        if (!bayarRes.ok) {
          throw new Error('Gagal update status pembayaran')
        }
      }

      // Update status akun
      if (formData.statusAkun !== pelanggan?.status) {
        const updateStatusRes = await fetch(`/api/pelanggan-ppp/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: formData.statusAkun,
          }),
        })

        if (!updateStatusRes.ok) {
          throw new Error('Gagal update status akun')
        }
      }

      // Renew pelanggan dengan opsi admin
      const renewRes = await fetch(`/api/pelanggan-ppp/${id}/renew`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipeLangganan: formData.tipeLangganan,
          hargaPaketId: formData.hargaPaketId || null,
          diskon: formData.diskon || 0,
        }),
      })

      if (!renewRes.ok) {
        const errorData = await renewRes.json()
        throw new Error(errorData.error || 'Gagal memperpanjang langganan')
      }

      const result = await renewRes.json()
      alert(
        `Langganan berhasil diperpanjang!\nJatuh tempo baru: ${new Date(result.jatuhTempoBaru).toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`,
      )

      router.push(`/admin/pelanggan/ppp/${id}`)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memperpanjang langganan')
    } finally {
      setSubmitting(false)
    }
  }

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return <PageLoader />
  }

  if (error && !pelanggan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 text-4xl">❌</div>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link
            href="/admin/pelanggan/ppp"
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Kembali
          </Link>
        </div>
      </div>
    )
  }

  if (!pelanggan) {
    return null
  }

  const totalTagihan = tagihanAktif ? tagihanAktif.total : 0
  const ppnTagihan = tagihanAktif ? tagihanAktif.ppn : 0
  const subtotalTagihan = totalTagihan - ppnTagihan

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            [PPP] Perpanjang Langganan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Perpanjang langganan untuk pelanggan {pelanggan.nama}
          </p>
        </div>
        <Link
          href={`/admin/pelanggan/ppp/${pelanggan.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <HiArrowLeft className="w-4 h-4" />
          Kembali
        </Link>
      </div>

      {/* Summary Box */}
      <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-400 mb-2">
              {tagihanAktif ? 'BELUM BAYAR' : 'TIDAK ADA TAGIHAN'}
            </h2>
            {tagihanAktif && (
              <p className="text-lg text-gray-700 dark:text-gray-300">
                {formatRupiah(subtotalTagihan)} (+ PPN {formatRupiah(ppnTagihan)})
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">ID Pelanggan</p>
              <p className="font-semibold text-gray-900 dark:text-white">{pelanggan.idPelanggan}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Nama Lengkap</p>
              <p className="font-semibold text-gray-900 dark:text-white">{pelanggan.nama}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Paket [PPP]</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {pelanggan.hargaPaket?.name || '-'} - {pelanggan.hargaPaket ? formatRupiah(pelanggan.hargaPaket.harga) : '-'}
              </p>
            </div>
            <div className="flex gap-2 items-end">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                {pelanggan.tipe === 'REGULER' ? 'REGULER' : 'NON_REGULAR'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Ubah Paket (Optional) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Ubah Paket (Optional)
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Paket Baru
            </label>
            <select
              value={formData.hargaPaketId}
              onChange={(e) => setFormData({ ...formData, hargaPaketId: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">- Pilih paket atau biarkan kosong -</option>
              {hargaPakets.map((paket) => (
                <option key={paket.id} value={paket.id}>
                  {paket.name} - {formatRupiah(paket.harga)}
                </option>
              ))}
            </select>
          </div>

          {/* Catatan Upgrade/Downgrade */}
          {formData.hargaPaketId && formData.hargaPaketId !== pelanggan.hargaPaketId && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h4 className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">
                Catatan Upgrade | Downgrade
              </h4>
              <ul className="space-y-1 text-xs text-green-700 dark:text-green-300">
                <li>• PERUBAHAN PAKET AKAN MERESET FEE RESELLER YANG DITENTUKAN MANUAL</li>
                <li>• SELISIH HARGA JUAL DAN HARGA MODAL PAKET AKAN DIGUNAKAN SEBAGAI FEE RESELLER</li>
                <li>• IP PELANGGAN YANG DISET STATIK AKAN DIATUR KE IP DINAMIS (JIKA GRUP PROFIL BERBEDA)</li>
              </ul>
            </div>
          )}
        </div>

        {/* Diskon */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Diskon (1x Waktu)
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jumlah Diskon (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.diskon}
              onChange={(e) => setFormData({ ...formData, diskon: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              TANPA PEMISAH RIBUAN, GUNAKAN TITIK (.) UNTUK PECAHAN
            </p>
          </div>
        </div>

        {/* Tipe Langganan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tipe Langganan
          </h3>
          <div className="mb-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pelanggan.tipe === 'REGULER'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}
            >
              {pelanggan.tipe}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mode Perpanjangan
            </label>
            <select
              value={formData.tipeLangganan}
              onChange={(e) => setFormData({ ...formData, tipeLangganan: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="SEKALI_BELI">SEKALI BELI (AKTIF DARI SEKARANG)</option>
              <option value="PERPANJANG">PERPANJANG (LANJUTKAN DARI JATUH TEMPO)</option>
            </select>
            {formData.tipeLangganan === 'SEKALI_BELI' && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                SEMUA TUNGGAKAN SEBELUMNYA AKAN DIABAIKAN
              </p>
            )}
          </div>
        </div>

        {/* Status Bayar & Status Akun */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status Bayar
              </label>
              <select
                value={formData.statusBayar}
                onChange={(e) => setFormData({ ...formData, statusBayar: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="BELUM_LUNAS">BELUM LUNAS</option>
                <option value="LUNAS">LUNAS (TERBAYAR)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status Akun
              </label>
              <select
                value={formData.statusAkun}
                onChange={(e) => setFormData({ ...formData, statusAkun: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="AKTIF">ENABLED</option>
                <option value="NONAKTIF">DISABLED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dibayar melalui */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Dibayar melalui
          </h3>
          <div>
            <select
              value={formData.metodePembayaran}
              onChange={(e) => setFormData({ ...formData, metodePembayaran: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="PEMBAYARAN_MANUAL">Pembayaran Manual</option>
              <option value="TRANSFER">Transfer</option>
              <option value="CASH">Cash</option>
              <option value="OVO">OVO</option>
              <option value="DANA">DANA</option>
              <option value="GOPAY">GoPay</option>
            </select>
          </div>
        </div>

        {/* Catatan */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Catatan</h3>
          <div>
            <textarea
              value={formData.catatan}
              onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              rows={3}
              placeholder="Catatan tambahan..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/admin/pelanggan/ppp/${pelanggan.id}`}
            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Or Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Memproses...' : 'Perpanjang Langganan'}
          </button>
        </div>
      </form>
    </div>
  )
}

