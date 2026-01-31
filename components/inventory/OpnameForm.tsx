'use client'

import { useState, useEffect } from 'react'
import type { StockOpnameFormData } from '@/lib/types/inventory'
import { getWithAuth, postWithAuth, putWithAuth } from '@/lib/api-client'

interface OpnameFormProps {
  initialData?: StockOpnameFormData
  onClose: () => void
  onSuccess: () => void
}

interface Barang {
  id: string
  kode: string
  nama: string
  satuan: string
}

interface Gudang {
  id: string
  kode: string
  nama: string
}

export function OpnameForm({ initialData, onClose, onSuccess }: OpnameFormProps) {
  const [formData, setFormData] = useState({
    barangId: initialData?.barangId || '',
    gudangId: initialData?.gudangId || '',
    stokFisik: initialData?.stokFisik?.toString() || '',
    keterangan: initialData?.keterangan || '',
    kondisiBaik: initialData?.kondisiBaik?.toString() || '0',
    kondisiRusak: initialData?.kondisiRusak?.toString() || '0',
    kondisiExpire: initialData?.kondisiExpire?.toString() || '0',
    lokasiPenyimpanan: initialData?.lokasiPenyimpanan || '',
    nomorRak: initialData?.nomorRak || '',
    nomorBox: initialData?.nomorBox || '',
    suhuPenyimpanan: initialData?.suhuPenyimpanan?.toString() || '',
    kelembaban: initialData?.kelembaban?.toString() || '',
    tanggalExpire: initialData?.tanggalExpire ? new Date(initialData.tanggalExpire).toISOString().split('T')[0] : '',
    nomorBatch: initialData?.nomorBatch || '',
    catatanDetail: initialData?.catatanDetail || ''
  })
  const [barangs, setBarangs] = useState<Barang[]>([])
  const [gudangs, setGudangs] = useState<Gudang[]>([])
  const [currentStock, setCurrentStock] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [barangRes, gudangRes] = await Promise.all([
          getWithAuth('/api/inventory/barang?limit=100'),
          getWithAuth('/api/inventory/gudang?view=all')
        ])

        if (barangRes.ok) {
          const barangData = await barangRes.json()
          const barangResult = barangData.data || barangData
          setBarangs(Array.isArray(barangResult.barangs) ? barangResult.barangs : (Array.isArray(barangResult) ? barangResult : []))
        } else {
          setBarangs([])
        }

        if (gudangRes.ok) {
          const gudangData = await gudangRes.json()
          const gudangResult = gudangData.data || gudangData
          setGudangs(Array.isArray(gudangResult.gudangs) ? gudangResult.gudangs : (Array.isArray(gudangResult) ? gudangResult : []))
        } else {
          setGudangs([])
        }
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setBarangs([])
        setGudangs([])
      }
    }

    fetchInitialData()
  }, [])

  useEffect(() => {
    async function fetchCurrentStock() {
      if (formData.barangId && formData.gudangId) {
        try {
          const response = await fetch(`/api/inventory/barang/stock?barangId=${formData.barangId}&gudangId=${formData.gudangId}`)
          if (response.ok) {
            const data = await response.json()
            const result = data.data || data
            setCurrentStock(result.stok || 0)
          }
        } catch (error) {
          console.error('Error fetching current stock:', error)
        }
      } else {
        setCurrentStock(0)
      }
    }

    fetchCurrentStock()
  }, [formData.barangId, formData.gudangId])

  // Auto-calculate stokFisik when condition values change
  useEffect(() => {
    const baik = parseInt(formData.kondisiBaik) || 0
    const rusak = parseInt(formData.kondisiRusak) || 0
    const expire = parseInt(formData.kondisiExpire) || 0
    const total = baik + rusak + expire

    if (total > 0) {
      setFormData(prev => ({ ...prev, stokFisik: total.toString() }))
    }
  }, [formData.kondisiBaik, formData.kondisiRusak, formData.kondisiExpire, formData.stokFisik])

  // Auto-distribute stokFisik when changed directly
  useEffect(() => {
    const fisik = parseInt(formData.stokFisik) || 0
    const baik = parseInt(formData.kondisiBaik) || 0
    const rusak = parseInt(formData.kondisiRusak) || 0
    const expire = parseInt(formData.kondisiExpire) || 0
    const totalKondisi = baik + rusak + expire

    if (fisik > 0 && totalKondisi === 0) {
      // Auto-distribute: 95% baik, 3% rusak, 2% expire
      const autoBaik = Math.round(fisik * 0.95)
      const autoRusak = Math.round(fisik * 0.03)
      const autoExpire = fisik - autoBaik - autoRusak

      setFormData(prev => ({
        ...prev,
        kondisiBaik: autoBaik.toString(),
        kondisiRusak: autoRusak.toString(),
        kondisiExpire: autoExpire.toString()
      }))
    }
  }, [formData.stokFisik, formData.kondisiBaik, formData.kondisiExpire, formData.kondisiRusak])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.barangId || !formData.gudangId || !formData.stokFisik) {
      setError('Barang, gudang, dan stok fisik harus diisi')
      return
    }

    const stokFisik = parseInt(formData.stokFisik)
    if (isNaN(stokFisik) || stokFisik < 0) {
      setError('Stok fisik harus berupa angka non-negatif')
      return
    }

    // Validate condition breakdown
    const kondisiBaik = parseInt(formData.kondisiBaik) || 0
    const kondisiRusak = parseInt(formData.kondisiRusak) || 0
    const kondisiExpire = parseInt(formData.kondisiExpire) || 0
    const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire

    if (totalKondisi > stokFisik) {
      setError('Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const submitData = {
        barangId: formData.barangId,
        gudangId: formData.gudangId,
        stokFisik,
        keterangan: formData.keterangan || null,
        kondisiBaik,
        kondisiRusak,
        kondisiExpire,
        lokasiPenyimpanan: formData.lokasiPenyimpanan || null,
        nomorRak: formData.nomorRak || null,
        nomorBox: formData.nomorBox || null,
        suhuPenyimpanan: formData.suhuPenyimpanan ? parseFloat(formData.suhuPenyimpanan) : null,
        kelembaban: formData.kelembaban ? parseFloat(formData.kelembaban) : null,
        tanggalExpire: formData.tanggalExpire || null,
        nomorBatch: formData.nomorBatch || null,
        catatanDetail: formData.catatanDetail || null
      }

      const url = initialData?.id
        ? `/api/inventory/opname/${initialData.id}`
        : '/api/inventory/opname'

      const response = initialData?.id
        ? await putWithAuth(url, submitData)
        : await postWithAuth(url, submitData)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan stock opname')
      }

      setSuccess(initialData?.id ? 'Stock opname berhasil diperbarui!' : 'Stock opname berhasil dicatat!')

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)

    } catch (error) {
      console.error('Error saving stock opname:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = Array.isArray(barangs) ? barangs.find(b => b.id === formData.barangId) : null
  const selectedGudang = Array.isArray(gudangs) ? gudangs.find(g => g.id === formData.gudangId) : null
  const selisih = (parseInt(formData.stokFisik) || 0) - currentStock

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Basic Information */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="barangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Barang *
          </label>
          <select
            id="barangId"
            value={formData.barangId}
            onChange={(e) => setFormData({ ...formData, barangId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
            disabled={!!initialData?.id}
          >
            <option value="">Pilih Barang</option>
            {barangs.map((barang) => (
              <option key={barang.id} value={barang.id}>
                {barang.kode} - {barang.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang *
          </label>
          <select
            id="gudangId"
            value={formData.gudangId}
            onChange={(e) => setFormData({ ...formData, gudangId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
            disabled={!!initialData?.id}
          >
            <option value="">Pilih Gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stock Information */}
      {selectedBarang && selectedGudang && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Informasi Stok</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Stok Sistem:</span>
              <span className="ml-2 font-medium text-blue-600">{currentStock} {selectedBarang.satuan}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Stok Fisik:</span>
              <span className={`ml-2 font-medium ${selisih === 0 ? 'text-green-600' : selisih > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formData.stokFisik || 0} {selectedBarang.satuan}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Selisih:</span>
              <span className={`ml-2 font-medium ${selisih === 0 ? 'text-green-600' : selisih > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {selisih > 0 ? '+' : ''}{selisih} {selectedBarang.satuan}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Physical Stock and Conditions */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="stokFisik" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stok Fisik *
          </label>
          <input
            type="number"
            id="stokFisik"
            value={formData.stokFisik}
            onChange={(e) => setFormData({ ...formData, stokFisik: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="0"
            min="0"
            required
          />
        </div>

        <div>
          <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Keterangan
          </label>
          <input
            type="text"
            id="keterangan"
            value={formData.keterangan}
            onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Keterangan stock opname"
          />
        </div>
      </div>

      {/* Condition Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Breakdown Kondisi Fisik</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="kondisiBaik" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Baik
            </label>
            <input
              type="number"
              id="kondisiBaik"
              value={formData.kondisiBaik}
              onChange={(e) => setFormData({ ...formData, kondisiBaik: e.target.value })}
              className="w-full px-3 py-2 border border-green-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="0"
            />
          </div>

          <div>
            <label htmlFor="kondisiRusak" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rusak
            </label>
            <input
              type="number"
              id="kondisiRusak"
              value={formData.kondisiRusak}
              onChange={(e) => setFormData({ ...formData, kondisiRusak: e.target.value })}
              className="w-full px-3 py-2 border border-red-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="0"
            />
          </div>

          <div>
            <label htmlFor="kondisiExpire" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bekas
            </label>
            <input
              type="number"
              id="kondisiExpire"
              value={formData.kondisiExpire}
              onChange={(e) => setFormData({ ...formData, kondisiExpire: e.target.value })}
              className="w-full px-3 py-2 border border-orange-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="0"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Total kondisi: {parseInt(formData.kondisiBaik) + parseInt(formData.kondisiRusak) + parseInt(formData.kondisiExpire)} item
        </p>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="lokasiPenyimpanan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Lokasi Penyimpanan
          </label>
          <input
            type="text"
            id="lokasiPenyimpanan"
            value={formData.lokasiPenyimpanan}
            onChange={(e) => setFormData({ ...formData, lokasiPenyimpanan: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Rak A-01"
          />
        </div>

        <div>
          <label htmlFor="nomorRak" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nomor Rak
          </label>
          <input
            type="text"
            id="nomorRak"
            value={formData.nomorRak}
            onChange={(e) => setFormData({ ...formData, nomorRak: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="A-01"
          />
        </div>

        <div>
          <label htmlFor="nomorBox" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nomor Box
          </label>
          <input
            type="text"
            id="nomorBox"
            value={formData.nomorBox}
            onChange={(e) => setFormData({ ...formData, nomorBox: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="BOX-001"
          />
        </div>

        <div>
          <label htmlFor="nomorBatch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nomor Batch
          </label>
          <input
            type="text"
            id="nomorBatch"
            value={formData.nomorBatch}
            onChange={(e) => setFormData({ ...formData, nomorBatch: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="BATCH-001"
          />
        </div>

        <div>
          <label htmlFor="tanggalExpire" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tanggal Expire
          </label>
          <input
            type="date"
            id="tanggalExpire"
            value={formData.tanggalExpire}
            onChange={(e) => setFormData({ ...formData, tanggalExpire: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="suhuPenyimpanan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Suhu Penyimpanan (°C)
          </label>
          <input
            type="number"
            id="suhuPenyimpanan"
            value={formData.suhuPenyimpanan}
            onChange={(e) => setFormData({ ...formData, suhuPenyimpanan: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="25"
            step="0.1"
          />
        </div>

        <div>
          <label htmlFor="kelembaban" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kelembaban (%)
          </label>
          <input
            type="number"
            id="kelembaban"
            value={formData.kelembaban}
            onChange={(e) => setFormData({ ...formData, kelembaban: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="50"
            step="0.1"
            min="0"
            max="100"
          />
        </div>
      </div>

      <div>
        <label htmlFor="catatanDetail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Catatan Detail
        </label>
        <textarea
          id="catatanDetail"
          value={formData.catatanDetail}
          onChange={(e) => setFormData({ ...formData, catatanDetail: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Catatan tambahan mengenai kondisi barang..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : (initialData?.id ? 'Perbarui' : 'Simpan')}
        </button>
      </div>
    </form>
  )
}