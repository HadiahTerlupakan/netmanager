'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TransferFormProps {
  initialData?: any
  onClose: () => void
  onSuccess?: () => void
}

export function TransferForm({ initialData, onClose, onSuccess }: TransferFormProps) {
  const [formData, setFormData] = useState({
    barangId: '',
    dariGudangId: '',
    keGudangId: '',
    jumlah: '',
    kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
    keterangan: ''
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [stockSumber, setStockSumber] = useState(0)
  const [stockPerKondisi, setStockPerKondisi] = useState({
    BARU: 0,
    BEKAS: 0,
    RUSAK: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch barang
        const barangResponse = await fetch('/api/inventory/barang?limit=100')
        const barangData = await barangResponse.json()
        setBarangs(barangData.barangs || [])

        // Fetch gudang
        const gudangResponse = await fetch('/api/inventory/gudang')
        const gudangData = await gudangResponse.json()
        setGudangs(gudangData.gudangs || [])
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setError('Gagal memuat data awal')
      }
    }

    fetchInitialData()
  }, [])

  useEffect(() => {
    async function fetchStockByCondition() {
      if (formData.barangId && formData.dariGudangId) {
        try {
          // Fetch condition-specific stock from API
          const response = await fetch(
            `/api/inventory/barang/stock/by-kondisi?barangId=${formData.barangId}&gudangId=${formData.dariGudangId}`
          )
          if (response.ok) {
            const data = await response.json()
            setStockPerKondisi(data.stockPerKondisi || { BARU: 0, BEKAS: 0, RUSAK: 0 })
            setStockSumber(data.totalStock || 0)
          } else {
            // Fallback to current logic if API fails
            const selectedBarang = barangs.find(b => b.id === formData.barangId)
            if (selectedBarang) {
              const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.dariGudangId)
              setStockSumber(stockInfo?.stok || 0)
            }
          }
        } catch (error) {
          console.error('Error fetching stock by condition:', error)
          // Fallback to current logic
          const selectedBarang = barangs.find(b => b.id === formData.barangId)
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.dariGudangId)
            setStockSumber(stockInfo?.stok || 0)
          }
        }
      } else {
        setStockPerKondisi({ BARU: 0, BEKAS: 0, RUSAK: 0 })
        setStockSumber(0)
      }
    }

    fetchStockByCondition()
  }, [formData.barangId, formData.dariGudangId, barangs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.barangId || !formData.dariGudangId || !formData.keGudangId || !formData.jumlah) {
      setError('Barang, gudang sumber, gudang tujuan, dan jumlah harus diisi')
      return
    }

    if (formData.dariGudangId === formData.keGudangId) {
      setError('Gudang sumber dan tujuan tidak boleh sama')
      return
    }

    const jumlah = parseInt(formData.jumlah)
    if (isNaN(jumlah) || jumlah <= 0) {
      setError('Jumlah harus berupa angka positif')
      return
    }

    const availableStockForCondition = stockPerKondisi[formData.kondisi] || 0
    if (jumlah > availableStockForCondition) {
      setError(`Jumlah ${formData.kondisi.toLowerCase()} tidak boleh melebihi stok tersedia (${availableStockForCondition})`)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          jumlah
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal melakukan transfer')
      }

      setSuccess(`Transfer berhasil! Kode transfer: ${data.kodeTransfer}`)

      // Reset form
      setFormData({
        barangId: '',
        dariGudangId: '',
        keGudangId: '',
        jumlah: '',
        kondisi: 'BARU',
        keterangan: ''
      })
      setStockSumber(0)
      setStockPerKondisi({ BARU: 0, BEKAS: 0, RUSAK: 0 })

      // Close form after 2 seconds
      setTimeout(() => {
        onClose()
        if (onSuccess) {
          onSuccess()
        }
        // Refresh the page to show updated data
        router.refresh()
      }, 2000)

    } catch (error) {
      console.error('Error submitting transfer:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudangSumber = gudangs.find(g => g.id === formData.dariGudangId)
  const selectedGudangTujuan = gudangs.find(g => g.id === formData.keGudangId)

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 font-bold'
    if (stock < 5) return 'text-yellow-600 font-semibold'
    return 'text-green-600'
  }

  const getKondisiColor = (kondisi: string) => {
    switch (kondisi) {
      case 'BARU': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'BEKAS': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'RUSAK': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  // Filter gudang tujuan to exclude gudang sumber
  const availableGudangTujuan = gudangs.filter(g => g.id !== formData.dariGudangId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          {success}
        </div>
      )}

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
            disabled={loading}
          >
            <option value="">Pilih barang</option>
            {barangs.map((barang) => (
              <option key={barang.id} value={barang.id}>
                {barang.kode} - {barang.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="kondisi" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kondisi Barang *
          </label>
          <select
            id="kondisi"
            value={formData.kondisi}
            onChange={(e) => setFormData({ ...formData, kondisi: e.target.value as 'BARU' | 'BEKAS' | 'RUSAK' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="BARU" disabled={stockPerKondisi.BARU === 0}>
              🟢 Baru {stockPerKondisi.BARU > 0 ? `(${stockPerKondisi.BARU})` : '(Tidak tersedia)'}
            </option>
            <option value="BEKAS" disabled={stockPerKondisi.BEKAS === 0}>
              🟡 Bekas {stockPerKondisi.BEKAS > 0 ? `(${stockPerKondisi.BEKAS})` : '(Tidak tersedia)'}
            </option>
            <option value="RUSAK" disabled={stockPerKondisi.RUSAK === 0}>
              🔴 Rusak {stockPerKondisi.RUSAK > 0 ? `(${stockPerKondisi.RUSAK})` : '(Tidak tersedia)'}
            </option>
          </select>
          <div className="mt-1">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiColor(formData.kondisi)}`}>
              {formData.kondisi === 'BARU' && 'Baru - Siap pakai'}
              {formData.kondisi === 'BEKAS' && 'Bekas - Pernah dipakai'}
              {formData.kondisi === 'RUSAK' && 'Rusak - Perlu perbaikan'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="dariGudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang Sumber *
          </label>
          <select
            id="dariGudangId"
            value={formData.dariGudangId}
            onChange={(e) => setFormData({ ...formData, dariGudangId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="">Pilih gudang sumber</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="keGudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang Tujuan *
          </label>
          <select
            id="keGudangId"
            value={formData.keGudangId}
            onChange={(e) => setFormData({ ...formData, keGudangId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !formData.dariGudangId}
          >
            <option value="">Pilih gudang tujuan</option>
            {availableGudangTujuan.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Barang & Gudang Info */}
      {(selectedBarang || selectedGudangSumber || selectedGudangTujuan) && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {selectedBarang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Barang terpilih:</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedBarang.kode} - {selectedBarang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Satuan: {selectedBarang.satuan}
                </p>
              </div>
            )}
            {selectedGudangSumber && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gudang sumber:</p>
                <p className="font-medium text-red-600 dark:text-red-400">
                  {selectedGudangSumber.kode} - {selectedGudangSumber.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudangSumber.lokasi || '-'}
                </p>
              </div>
            )}
            {selectedGudangTujuan && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gudang tujuan:</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {selectedGudangTujuan.kode} - {selectedGudangTujuan.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudangTujuan.lokasi || '-'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Info */}
      {stockSumber >= 0 && selectedBarang && selectedGudangSumber && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Stok tersedia di {selectedGudangSumber.nama}:
              </p>
              <p className={`text-2xl font-bold ${getStockStatusColor(stockSumber)}`}>
                {stockSumber} {selectedBarang.satuan}
              </p>
            </div>
            <div className="text-right">
              {stockSumber === 0 && (
                <p className="text-sm text-red-500">⚠️ Stok habis!</p>
              )}
              {stockSumber > 0 && stockSumber < 5 && (
                <p className="text-sm text-yellow-500">⚠️ Stok menipis!</p>
              )}
              {stockSumber >= 5 && (
                <p className="text-sm text-green-500">✅ Stok tersedia</p>
              )}
            </div>
          </div>

          {/* Stock per Kondisi */}
          <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
              Stok per Kondisi:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className={`text-center p-2 rounded ${
                formData.kondisi === 'BARU' ? 'bg-green-100 ring-2 ring-green-500' : 'bg-white/50'
              }`}>
                <p className="text-xs text-green-700 font-medium">Baru</p>
                <p className="text-sm font-bold text-green-800">
                  {stockPerKondisi.BARU}
                </p>
              </div>
              <div className={`text-center p-2 rounded ${
                formData.kondisi === 'BEKAS' ? 'bg-yellow-100 ring-2 ring-yellow-500' : 'bg-white/50'
              }`}>
                <p className="text-xs text-yellow-700 font-medium">Bekas</p>
                <p className="text-sm font-bold text-yellow-800">
                  {stockPerKondisi.BEKAS}
                </p>
              </div>
              <div className={`text-center p-2 rounded ${
                formData.kondisi === 'RUSAK' ? 'bg-red-100 ring-2 ring-red-500' : 'bg-white/50'
              }`}>
                <p className="text-xs text-red-700 font-medium">Rusak</p>
                <p className="text-sm font-bold text-red-800">
                  {stockPerKondisi.RUSAK}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Jumlah Transfer *
          </label>
          <div className="relative">
            <input
              type="number"
              id="jumlah"
              value={formData.jumlah}
              onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
              className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="1"
              max={stockPerKondisi[formData.kondisi] || 0}
              disabled={loading || stockSumber === 0}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || 'pcs'}
            </span>
          </div>
          {stockPerKondisi[formData.kondisi] > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Maks: {stockPerKondisi[formData.kondisi]} {selectedBarang?.satuan || 'pcs'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tanggal Transfer
          </label>
          <input
            type="date"
            id="tanggal"
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Keterangan Transfer
        </label>
        <textarea
          id="keterangan"
          value={formData.keterangan}
          onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Transfer untuk cabang bulan Desember"
          disabled={loading}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
          disabled={loading || stockSumber === 0 || !formData.keGudangId || (stockPerKondisi[formData.kondisi] || 0) === 0}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Mentransfer...' : 'Transfer Barang'}
        </button>
      </div>
    </form>
  )
}