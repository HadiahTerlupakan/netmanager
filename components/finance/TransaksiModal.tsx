"use client"

import { useState, useEffect } from 'react'
import { HiArrowPath } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'

const KATEGORI_PEMASUKAN = [
  'LANGGANAN_INTERNET',
  'LANGGANAN_VOICE',
  'SETUP_INTERNET',
  'SETUP_VOICE',
  'PENJUALAN_EQUIPMENT',
  'SEWA_EQUIPMENT',
  'JASA_INSTALASI',
  'BIAYA_INSTALLASI',
  'DEPOSIT_PELANGANAN',
  'PENALTY_LATE_PAYMENT',
  'DONASI',
  'HIBAH',
  'LAINNYA',
]

const KATEGORI_PENGELUARAN = [
  'BIAYA_KARYAWAN',
  'BIAYA_BONUS',
  'BIAYA_THR',
  'BIAYA_LEMBUR',
  'BIAYA_CUTI',
  'BIAYA_ASURANSI',
  'BIAYA_JAMSOSTEK',
  'SEWA_KANTOR',
  'SEWA_GEDUNG',
  'SEWA_RUMAH',
  'SEWA_KENDARAAN',
  'LISTRIK_PLN',
  'LISTRIK_TELKOM',
  'INTERNET_ISP',
  'INTERNET_BACKBONE',
  'BANDWIDTH',
  'VOICE_CALL',
  'SMS_GATEWAY',
  'MAINTENANCE_JARINGAN',
  'MAINTENANCE_PERANGKAT',
  'MAINTENANCE_SERVER',
  'MAINTENANCE_EQUIPMENT',
  'SUKU_CADANGAN',
  'PERIZIN_IJIN',
  'PERIZIN_POSTEL',
  'PAJAK_PBB',
  'PAJAK_PPH',
  'PAJAK_REKLAME',
  'PAJAK_BEBAN_BAKU',
  'ASURANSI_KARYAWAN',
  'ASURANSI_KENDARAAN',
  'ASURANSI_PROPERTY',
  'ASURANSI_LIABILITY',
  'BANK_ADMIN',
  'BANK_TRANSFER',
  'BANK_MATERAI',
  'BANK_CASH',
  'E_WALLET',
  'MARKETING',
  'ADVERTISING',
  'TRAINING',
  'TRAVEL',
  'ENTERTAINMENT',
  'LEGAL',
  'AKUNTANSI',
  'AUDIT',
  'LAINNYA',
]

const SUB_KATEGORI_PEMASUKAN = {
  'LANGGANAN_INTERNET': ['Paket Internet', 'Add-on Internet', 'Upgrade Kecepatan'],
  'LANGGANAN_VOICE': ['Paket Telepon', 'Pulsa Telepon', 'Sewa Nomor'],
  'SETUP_INTERNET': ['Instalasi Baru', 'Setup Router', 'Konfigurasi Jaringan'],
  'SETUP_VOICE': ['Instalasi Telepon Baru', 'Porting Nomor', 'Setup PABX'],
  'PENJUALAN_EQUIPMENT': ['Modem', 'Router', 'Access Point', 'Kabel LAN'],
  'SEWA_EQUIPMENT': ['Modem', 'Router', 'Access Point', 'Kabel LAN'],
  'JASA_INSTALASI': ['Instalasi di Lokasi Pelanggan', 'Konfigurasi Jaringan', 'Setup Perangkat'],
  'BIAYA_INSTALLASI': ['Instalasi di Lokasi Pelanggan', 'Konfigurasi Jaringan', 'Setup Perangkat'],
  'DEPOSIT_PELANGGANAN': ['Deposit Pelanggan Baru', 'Deposit Pelanggan Existing'],
  'PENALTY_LATE_PAYMENT': ['Denda Keterlambatan Pembayaran'],
  'DONASI': ['Donasi dari Individu', 'Donasi dari Perusahaan'],
  'HIBAH': ['Hadiah Undian', 'Hadiah Event', 'Hadiah Promosi'],
  'LAINNYA': ['Lainnya']
}

const SUB_KATEGORI_PENGELUARAN = {
  'BIAYA_KARYAWAN': ['Gaji Karyawan', 'Gaji Staff', 'Tunjangan', 'Lembur', 'Cuti Bonus', 'THR', 'Asuransi', 'Jamsostek'],
  'BIAYA_BONUS': ['Bonus Kinerja', 'Bonus Tahunan', 'Bonus Proyek'],
  'BIAYA_THR': ['THR Lebaran', 'THR Tahun Baru', 'THR Natal'],
  'BIAYA_LEMBUR': ['Lembur Harian', 'Lembur Mingguan', 'Lembur Proyek'],
  'BIAYA_CUTI': ['Cuti Tahunan', 'Cuti Sakit', 'Cuti Melahirkan'],
  'BIAYA_ASURANSI': ['Asuransi Kesehatan', 'Asuransi Jiwa', 'BPJS Kesehatan'],
  'BIAYA_JAMSOSTEK': ['BPJS Ketenagakerjaan', 'Jamsostek'],
  'SEWA_KANTOR': ['Sewa Kantor Bulanan', 'Sewa Kantor Tahunan'],
  'SEWA_GEDUNG': ['Sewa Gedung Bulanan', 'Sewa Gedung Tahunan'],
  'SEWA_RUMAH': ['Sewa Rumah Karyawan'],
  'SEWA_KENDARAAN': ['Sewa Mobil', 'Sewa Motor', 'Leasing Kendaraan'],
  'LISTRIK_PLN': ['Listrik PLN Kantor', 'Listrik PLN Gedung'],
  'LISTRIK_TELKOM': ['Listrik PDAM', 'Air PDAM'],
  'INTERNET_ISP': ['Internet ISP', 'VPN', 'Domain', 'Hosting'],
  'INTERNET_BACKBONE': ['Bandwidth Backbone', 'Sewa Bandwidth'],
  'BANDWIDTH': ['Bandwidth Tambahan', 'Upgrade Bandwidth'],
  'VOICE_CALL': ['Telepon Kantor', 'Telepon Seluler', 'Pulsa'],
  'SMS_GATEWAY': ['SMS Gateway', 'WhatsApp API'],
  'MAINTENANCE_JARINGAN': ['Perbaikan Jaringan', 'Upgrade Jaringan', 'Monitoring Jaringan'],
  'MAINTENANCE_PERANGKAT': ['Perbaikan Modem', 'Perbaikan Router', 'Perbaikan Access Point'],
  'MAINTENANCE_SERVER': ['Maintenance Server', 'Upgrade Server', 'Backup Server'],
  'MAINTENANCE_EQUIPMENT': ['Maintenance Modem', 'Maintenance Router', 'Maintenance Access Point'],
  'SUKU_CADANGAN': ['Suku Cadang Jaringan', 'Suku Cadang Server', 'Suku Cadang Perangkat'],
  'PERIZIN_IJIN': ['Ijin Usaha', 'Ijin Operasional'],
  'PERIZIN_POSTEL': ['Ijin Postel', 'Ijin Frekuensi'],
  'PAJAK_PBB': ['PBB Kantor', 'PBB Gedung', 'PBB Tanah'],
  'PAJAK_PPH': ['PPh 21', 'PPh 23', 'PPh 25', 'PPh 29'],
  'PAJAK_REKLAME': ['Pajak Reklame'],
  'PAJAK_BEBAN_BAKU': ['Pajak Beban Lainnya'],
  'ASURANSI_KARYAWAN': ['Asuransi Kesehatan Karyawan', 'Asuransi Jiwa Karyawan'],
  'ASURANSI_KENDARAAN': ['Asuransi Mobil', 'Asuransi Motor'],
  'ASURANSI_PROPERTY': ['Asuransi Gedung', 'Asuransi Kantor'],
  'ASURANSI_LIABILITY': ['Asuransi Tanggung Jawab'],
  'BANK_ADMIN': ['Biaya Admin Bank', 'Biaya Transfer'],
  'BANK_TRANSFER': ['Biaya Transfer Antar Bank', 'Biaya Kliring'],
  'BANK_MATERAI': ['Materai'],
  'BANK_CASH': ['Penarikan Tunai', 'Setoran Tunai'],
  'E_WALLET': ['Biaya Admin E-Wallet', 'Top Up E-Wallet'],
  'MARKETING': ['Iklan Online', 'Iklan Offline', 'Promosi', 'Event Marketing'],
  'ADVERTISING': ['Iklan Google', 'Iklan Facebook', 'Iklan Instagram', 'Billboard'],
  'TRAINING': ['Training Karyawan', 'Training Pelanggan', 'Sertifikasi'],
  'TRAVEL': ['Perjalanan Dinas', 'Akomodasi', 'Transportasi'],
  'ENTERTAINMENT': ['Acara Kantor', 'Outing Kantor', 'Team Building'],
  'LEGAL': ['Biaya Hukum', 'Biaya Notaris', 'Biaya Pengadilan'],
  'AKUNTANSI': ['Jasa Akuntansi', 'Software Akuntansi', 'Konsultasi Pajak'],
  'AUDIT': ['Audit Internal', 'Audit Eksternal'],
  'LAINNYA': ['Lainnya']
}

const METODE_BAYAR_OPTIONS = [
  'TRANSFER',
  'CASH',
  'DEBIT',
  'KREDIT',
  'E-WALLET',
]

interface TransaksiModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  transaksiId?: string | null
  transaksiType?: 'pemasukan' | 'pengeluaran' | null
  apiEndpoint?: string
  token?: string | null
}

export default function TransaksiModal({
  isOpen,
  onClose,
  onSuccess,
  transaksiId,
  transaksiType: initialType,
  apiEndpoint = '/api',
  token,
}: TransaksiModalProps) {
  const [loading, setLoading] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transaksiType, setTransaksiType] = useState<'pemasukan' | 'pengeluaran'>(
    initialType || 'pemasukan'
  )

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    nomorBukti: '',
    tipePengeluaran: '' as '' | 'CAPEX' | 'OPEX',
    kategori: '',
    subKategori: '',
    deskripsi: '',
    jumlah: '',
    metodeBayar: '',
    catatan: '',
  })

  // Get sub-categories based on main category
  const getSubKategoriOptions = (mainKategori: string) => {
    if (transaksiType === 'pemasukan') {
      return SUB_KATEGORI_PEMASUKAN[mainKategori as keyof typeof SUB_KATEGORI_PEMASUKAN] || []
    } else if (transaksiType === 'pengeluaran') {
      return SUB_KATEGORI_PENGELUARAN[mainKategori as keyof typeof SUB_KATEGORI_PENGELUARAN] || []
    }
    return []
  }

  const isEdit = !!transaksiId

  useEffect(() => {
    if (isOpen && isEdit && transaksiId) {
      loadData()
    } else if (isOpen && !isEdit) {
      // Reset form untuk create
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        nomorBukti: '',
        tipePengeluaran: '' as '' | 'CAPEX' | 'OPEX',
        kategori: '',
        subKategori: '',
        deskripsi: '',
        jumlah: '',
        metodeBayar: '',
        catatan: '',
      })
      setError(null)
      if (initialType) {
        setTransaksiType(initialType)
      }
    }
  }, [isOpen, isEdit, transaksiId, initialType])

  const loadData = async () => {
    if (!transaksiId) return
    setFormLoading(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['x-finance-token'] = token
      }

      // Try to fetch from the known type first, otherwise try both
      let response: Response | null = null
      let data: any = null
      let actualType: 'pemasukan' | 'pengeluaran' = transaksiType

      if (initialType) {
        // We know the type, fetch directly
        const endpoint = initialType === 'pemasukan'
          ? `${apiEndpoint}/pemasukan/${transaksiId}`
          : `${apiEndpoint}/pengeluaran/${transaksiId}`

        response = await fetch(endpoint, { headers })
        if (response.ok) {
          data = await response.json()
          actualType = initialType
        }
      } else {
        // Type unknown, try pengeluaran first (more common)
        const pengeluaranEndpoint = `${apiEndpoint}/pengeluaran/${transaksiId}`
        response = await fetch(pengeluaranEndpoint, { headers })

        if (response.ok) {
          data = await response.json()
          actualType = 'pengeluaran'
        } else {
          // Try pemasukan
          const pemasukanEndpoint = `${apiEndpoint}/pemasukan/${transaksiId}`
          response = await fetch(pemasukanEndpoint, { headers })

          if (response.ok) {
            data = await response.json()
            actualType = 'pemasukan'
          }
        }
      }

      if (!response || !response.ok || !data) {
        throw new Error('Gagal memuat data transaksi')
      }

      // Update transaksiType state with actual type
      setTransaksiType(actualType)

      const tanggal = new Date(data.tanggal).toISOString().split('T')[0]
      setFormData({
        tanggal,
        nomorBukti: data.nomorBukti || '',
        tipePengeluaran: data.tipePengeluaran || '',
        kategori: data.kategori || '',
        subKategori: data.subKategori || '',
        deskripsi: data.deskripsi || '',
        jumlah: data.jumlah?.toString() || '',
        metodeBayar: data.metodeBayar || '',
        catatan: data.catatan || '',
      })
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data')
    } finally {
      setFormLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (transaksiType === 'pengeluaran' && !formData.tipePengeluaran) {
      setError('Tipe pengeluaran wajib diisi')
      setLoading(false)
      return
    }

    if (!formData.tanggal || !formData.kategori || !formData.deskripsi || !formData.jumlah) {
      setError('Tanggal, kategori, deskripsi, dan jumlah wajib diisi')
      setLoading(false)
      return
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['x-finance-token'] = token
      }

      const baseEndpoint = transaksiType === 'pemasukan'
        ? `${apiEndpoint}/pemasukan`
        : `${apiEndpoint}/pengeluaran`

      const url = isEdit ? `${baseEndpoint}/${transaksiId}` : baseEndpoint
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          tanggal: formData.tanggal,
          nomorBukti: formData.nomorBukti,
          ...(transaksiType === 'pengeluaran' && { tipePengeluaran: formData.tipePengeluaran }),
          kategori: formData.kategori,
          subKategori: formData.subKategori,
          deskripsi: formData.deskripsi,
          jumlah: formData.jumlah, // Send as string to support BigInt values
          metodeBayar: formData.metodeBayar || null,
          catatan: formData.catatan || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Gagal ${isEdit ? 'mengupdate' : 'menambah'} transaksi`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat ${isEdit ? 'mengupdate' : 'menambah'} transaksi`)
    } finally {
      setLoading(false)
    }
  }

  const kategoriOptions = transaksiType === 'pemasukan' ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN
  const subKategoriOptions = getSubKategoriOptions(formData.kategori)

  // Update sub-category when main category changes
  useEffect(() => {
    if (formData.kategori) {
      setFormData(prev => ({
        ...prev,
        subKategori: ''
      }))
    }
  }, [formData.kategori])

  return (
    <Modal open={isOpen} onClose={onClose} title={isEdit ? `Edit ${transaksiType === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}` : 'Tambah Transaksi'}>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {formLoading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <>
            {!isEdit && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jenis Transaksi <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer touch-target">
                    <input
                      type="radio"
                      name="transaksiType"
                      value="pemasukan"
                      checked={transaksiType === 'pemasukan'}
                      onChange={(e) => {
                        setTransaksiType('pemasukan')
                        setFormData({ ...formData, kategori: '', subKategori: '' })
                      }}
                      className="w-5 h-5 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Pemasukan</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer touch-target">
                    <input
                      type="radio"
                      name="transaksiType"
                      value="pengeluaran"
                      checked={transaksiType === 'pengeluaran'}
                      onChange={(e) => {
                        setTransaksiType('pengeluaran')
                        setFormData({ ...formData, kategori: '', subKategori: '' })
                      }}
                      className="w-5 h-5 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Pengeluaran</span>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="nomorBukti" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nomor Bukti
              </label>
              <input
                id="nomorBukti"
                type="text"
                value={formData.nomorBukti}
                onChange={(e) => setFormData({ ...formData, nomorBukti: e.target.value })}
                placeholder="Contoh: INV/2023/12/001"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {transaksiType === 'pengeluaran' && (
              <div className="space-y-2">
                <label htmlFor="tipePengeluaran" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipe Pengeluaran <span className="text-red-500">*</span>
                </label>
                <select
                  id="tipePengeluaran"
                  value={formData.tipePengeluaran}
                  onChange={(e) => setFormData({ ...formData, tipePengeluaran: e.target.value as 'CAPEX' | 'OPEX' })}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih Tipe</option>
                  <option value="CAPEX">CAPEX</option>
                  <option value="OPEX">OPEX</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  id="tanggal"
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="kategori" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  id="kategori"
                  value={formData.kategori}
                  onChange={(e) => {
                    setFormData({ ...formData, kategori: e.target.value });
                    setFormData({ ...formData, subKategori: '' }); // Clear sub-kategori when kategori changes
                  }}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih Kategori</option>
                  {kategoriOptions.map((kat) => (
                    <option key={kat} value={kat}>
                      {kat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.kategori && (
              <div className="space-y-2">
                <label htmlFor="subKategori" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sub-Kategori
                </label>
                <input
                  id="subKategori"
                  type="text"
                  value={formData.subKategori}
                  onChange={(e) => setFormData({ ...formData, subKategori: e.target.value })}
                  placeholder="Contoh: Paket Internet 10Mbps"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Deskripsi <span className="text-red-500">*</span>
              </label>
              <input
                id="deskripsi"
                type="text"
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                required
                placeholder={transaksiType === 'pemasukan' ? 'Contoh: Penjualan paket internet bulan Januari' : 'Contoh: Pembayaran listrik bulan Januari'}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jumlah (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  id="jumlah"
                  type="number"
                  value={formData.jumlah}
                  onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                  required
                  min="0"
                  placeholder="0"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="metodeBayar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Metode Pembayaran
                </label>
                <select
                  id="metodeBayar"
                  value={formData.metodeBayar}
                  onChange={(e) => setFormData({ ...formData, metodeBayar: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Pilih Metode</option>
                  {METODE_BAYAR_OPTIONS.map((metode) => (
                    <option key={metode} value={metode}>
                      {metode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="catatan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Catatan
              </label>
              <textarea
                id="catatan"
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                rows={3}
                placeholder="Catatan tambahan (opsional)"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className={`touch-target flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-white text-base md:text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${transaksiType === 'pemasukan' ? 'bg-green-600' : 'bg-red-600'
                  }`}
              >
                {loading ? (
                  <>
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  isEdit ? 'Simpan Perubahan' : 'Simpan'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="touch-target px-4 py-3 text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Batal
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}

