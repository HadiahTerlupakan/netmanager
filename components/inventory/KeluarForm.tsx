'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PhotoUpload } from './PhotoUpload'

interface KeluarFormProps {
  initialData?: any
  onClose: () => void
}

export function KeluarForm({ initialData, onClose }: KeluarFormProps) {
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    jumlah: '',
    kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
    isHilang: false, // Checkbox for lost items
    keterangan: '',
    tanggal: new Date().toISOString().split('T')[0],
    employeeId: '',
    purpose: ''
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [stockByCondition, setStockByCondition] = useState({
    BARU: 0,
    BEKAS: 0,
    RUSAK: 0,
    totalStok: 0
  })
  const [currentStock, setCurrentStock] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([])
  const [transactionId, setTransactionId] = useState<string | null>(null)
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

        // Fetch employees
        const employeeResponse = await fetch('/api/employees')
        const employeeData = await employeeResponse.json()
        setEmployees(employeeData.employees || [])

        // If in edit mode, populate form with initial data
        if (initialData) {
          setFormData({
            barangId: initialData.barangId || '',
            gudangId: initialData.gudangId || '',
            jumlah: initialData.jumlah?.toString() || '',
            kondisi: initialData.kondisi || 'BARU',
            isHilang: initialData.isHilang || false,
            keterangan: initialData.keterangan || '',
            tanggal: initialData.tanggal ? new Date(initialData.tanggal).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            employeeId: initialData.employeeId || '',
            purpose: initialData.purpose || ''
          })
          setTransactionId(initialData.id || null)
        }
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setError('Gagal memuat data awal')
      }
    }

    fetchInitialData()
  }, [initialData])

  useEffect(() => {
    async function fetchCurrentStock() {
      if (formData.barangId && formData.gudangId) {
        try {
          // Check current stock by condition for this barang-gudang combination
          const response = await fetch(`/api/inventory/keluar?checkStock=true&barangId=${formData.barangId}&gudangId=${formData.gudangId}`)
          if (response.ok) {
            const data = await response.json()
            setStockByCondition({
              BARU: data.stokByKondisi.BARU,
              BEKAS: data.stokByKondisi.BEKAS,
              RUSAK: data.stokByKondisi.RUSAK,
              totalStok: data.stokByKondisi.total
            })
            setCurrentStock(data.stokByKondisi.total)
          } else {
            // Fallback to old method if API fails
            const selectedBarang = barangs.find(b => b.id === formData.barangId)
            if (selectedBarang) {
              const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.gudangId)
              setCurrentStock(stockInfo?.stok || 0)
            }
          }
        } catch (error) {
          console.error('Error fetching current stock:', error)
          // Fallback to old method
          const selectedBarang = barangs.find(b => b.id === formData.barangId)
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.gudangId)
            setCurrentStock(stockInfo?.stok || 0)
          }
        }
      } else {
        setCurrentStock(0)
        setStockByCondition({
          BARU: 0,
          BEKAS: 0,
          RUSAK: 0,
          totalStok: 0
        })
      }
    }

    fetchCurrentStock()
  }, [formData.barangId, formData.gudangId, barangs])

  // Reset form when condition changes to ensure proper behavior
  useEffect(() => {
    if (formData.barangId && formData.gudangId && stockByCondition.totalStok > 0) {
      let kondisiStok = 0
      switch (formData.kondisi) {
        case 'BARU':
          kondisiStok = stockByCondition.BARU
          break
        case 'BEKAS':
          kondisiStok = stockByCondition.BEKAS
          break
        case 'RUSAK':
          kondisiStok = stockByCondition.RUSAK
          break
        default:
          kondisiStok = stockByCondition.BARU
          break
      }

      // Reset jumlah to 1 if switching to a condition with stock but no valid current value
      if (kondisiStok > 0 && (parseInt(formData.jumlah) > kondisiStok || parseInt(formData.jumlah) === 0)) {
        setFormData(prev => ({ ...prev, jumlah: '1' }))
      } else if (kondisiStok === 0) {
        // Clear jumlah if switching to condition with no stock
        setFormData(prev => ({ ...prev, jumlah: '' }))
      }
    }
  }, [formData.kondisi, stockByCondition, formData.barangId, formData.gudangId])

  // Effect to handle photo upload completion
  useEffect(() => {
    // Check if all photos have been uploaded successfully
    if (transactionId && uploadedPhotos.length > 0) {
      const allUploaded = uploadedPhotos.every(photo => photo.status === 'success')
      const hasError = uploadedPhotos.some(photo => photo.status === 'error')

      if (allUploaded) {
        setSuccess('Barang keluar berhasil dicatat! Foto berhasil diunggah.')

        // Reset form after a short delay
        setTimeout(() => {
          setFormData({
            barangId: '',
            gudangId: '',
            jumlah: '',
            kondisi: 'BARU',
            isHilang: false,
            keterangan: '',
            tanggal: new Date().toISOString().split('T')[0],
            employeeId: '',
            purpose: ''
          })
          setCurrentStock(0)
          setUploadedPhotos([])
          setTransactionId(null)
          onClose()
        }, 2000)
      } else if (hasError) {
        setSuccess('Barang keluar berhasil dicatat, namun beberapa foto gagal diunggah.')
      }
    }
  }, [uploadedPhotos, transactionId, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation - only validate in create mode
    if (!initialData) {
      if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
        setError('Barang, gudang, dan jumlah harus diisi')
        return
      }

      const jumlah = parseInt(formData.jumlah)
      if (isNaN(jumlah) || jumlah <= 0) {
        setError('Jumlah harus berupa angka positif')
        return
      }

      // Check stock availability for selected condition
      let stokTersedia = 0
      switch (formData.kondisi) {
        case 'BARU':
          stokTersedia = stockByCondition.BARU
          break
        case 'BEKAS':
          stokTersedia = stockByCondition.BEKAS
          break
        case 'RUSAK':
          stokTersedia = stockByCondition.RUSAK
          break
        default:
          stokTersedia = stockByCondition.BARU
          break
      }

      if (jumlah > stokTersedia) {
        setError(`Jumlah tidak boleh melebihi stok tersedia untuk kondisi ${formData.kondisi} (${stokTersedia})`)
        return
      }
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (initialData) {
        // Edit mode - we already have a transaction ID
        if (uploadedPhotos.length > 0) {
          setSuccess('Mengunggah foto...')
          // The PhotoUpload component will handle the upload automatically
          // when transactionId is already set
        } else {
          setSuccess('Tidak ada foto baru untuk diunggah')
          setTimeout(() => {
            onClose()
          }, 1000)
        }
      } else {
        // Create mode - create the inventory transaction first
        const response = await fetch('/api/inventory/keluar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barangId: formData.barangId,
            gudangId: formData.gudangId,
            jumlah: parseInt(formData.jumlah),
            kondisi: formData.kondisi,
            isHilang: formData.isHilang,
            keterangan: formData.keterangan,
            tanggal: formData.tanggal,
            employeeId: formData.employeeId,
            purpose: formData.purpose
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('API Error Response:', data)
          throw new Error(data.error || 'Gagal mencatat barang keluar')
        }

        // Extract transaction ID from response
        if (data.keluarId) {
          setTransactionId(data.keluarId)

          // If there are photos to upload, trigger the upload
          if (uploadedPhotos.length > 0) {
            setSuccess('Barang keluar berhasil dicatat! Mengunggah foto...')
          } else {
            setSuccess('Barang keluar berhasil dicatat!')

            // Reset form after a short delay
            setTimeout(() => {
              setFormData({
                barangId: '',
                gudangId: '',
                jumlah: '',
                kondisi: 'BARU',
                isHilang: false,
                keterangan: '',
                tanggal: new Date().toISOString().split('T')[0],
                employeeId: '',
                purpose: ''
              })
              setCurrentStock(0)
              setUploadedPhotos([])
              setTransactionId(null)
              onClose()
            }, 1000)
          }
        } else {
          setSuccess('Barang keluar berhasil dicatat!')

          // Reset form
          setTimeout(() => {
            setFormData({
              barangId: '',
              gudangId: '',
              jumlah: '',
              kondisi: 'BARU',
              isHilang: false,
              keterangan: '',
              tanggal: new Date().toISOString().split('T')[0],
              employeeId: '',
              purpose: ''
            })
            setCurrentStock(0)
            setUploadedPhotos([])
            onClose()
          }, 1000)
        }
      }

    } catch (error) {
      console.error('Error submitting barang keluar:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudang = gudangs.find(g => g.id === formData.gudangId)

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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {initialData ? 'Edit Barang Keluar' : 'Catat Barang Keluar'}
        </h2>
        {initialData && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambahkan foto untuk dokumentasi transaksi yang sudah ada
          </p>
        )}
      </div>

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
          <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang *
          </label>
          <select
            id="gudangId"
            value={formData.gudangId}
            onChange={(e) => setFormData({ ...formData, gudangId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="">Pilih gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Barang & Gudang Info */}
      {(selectedBarang || selectedGudang) && (
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
            {selectedGudang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gudang terpilih:</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedGudang.kode} - {selectedGudang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudang.lokasi || '-'}
                </p>
              </div>
            )}
            {stockByCondition.totalStok >= 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stok tersedia per kondisi:</p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">🟢 Baru:</span>
                    <span className="text-sm font-medium text-green-600">{stockByCondition.BARU}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">🟡 Bekas:</span>
                    <span className="text-sm font-medium text-yellow-600">{stockByCondition.BEKAS}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-gray-400">🔴 Rusak:</span>
                    <span className="text-sm font-medium text-red-600">{stockByCondition.RUSAK}</span>
                  </div>
                  <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total:</span>
                      <span className={`text-lg font-bold ${getStockStatusColor(stockByCondition.totalStok)}`}>
                        {stockByCondition.totalStok} {selectedBarang?.satuan || 'pcs'}
                      </span>
                    </div>
                  </div>
                </div>
                {stockByCondition.totalStok === 0 && <p className="text-xs text-red-500 mt-2">Stok habis!</p>}
                {stockByCondition.totalStok > 0 && stockByCondition.totalStok < 5 && <p className="text-xs text-yellow-500 mt-2">Stok menipis!</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Jumlah *
          </label>
          <div className="relative">
            <input
              type="number"
              id="jumlah"
              value={formData.jumlah}
              onChange={(e) => {
                const value = e.target.value
                let kondisiStok = 0

                switch (formData.kondisi) {
                  case 'BARU':
                    kondisiStok = stockByCondition.BARU
                    break
                  case 'BEKAS':
                    kondisiStok = stockByCondition.BEKAS
                    break
                  case 'RUSAK':
                    kondisiStok = stockByCondition.RUSAK
                    break
                  default:
                    kondisiStok = stockByCondition.BARU
                    break
                }

                // If value exceeds available stock, adjust to maximum
                if (parseInt(value) > kondisiStok) {
                  setFormData({ ...formData, jumlah: kondisiStok.toString() })
                } else {
                  setFormData({ ...formData, jumlah: value })
                }
              }}
              className={`w-full px-3 py-2 pr-16 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white ${parseInt(formData.jumlah) > (
                formData.kondisi === 'BARU' ? stockByCondition.BARU :
                  formData.kondisi === 'BEKAS' ? stockByCondition.BEKAS :
                    formData.kondisi === 'RUSAK' ? stockByCondition.RUSAK :
                      stockByCondition.totalStok
              )
                ? 'border-red-500 border-2'
                : 'border-gray-300'
                }`}
              placeholder="0"
              min="1"
              max={
                formData.kondisi === 'BARU' ? stockByCondition.BARU :
                  formData.kondisi === 'BEKAS' ? stockByCondition.BEKAS :
                    formData.kondisi === 'RUSAK' ? stockByCondition.RUSAK :
                      stockByCondition.totalStok
              }
              disabled={
                loading ||
                stockByCondition.totalStok === 0 ||
                (formData.kondisi === 'BARU' && stockByCondition.BARU === 0) ||
                (formData.kondisi === 'BEKAS' && stockByCondition.BEKAS === 0) ||
                (formData.kondisi === 'RUSAK' && stockByCondition.RUSAK === 0)
              }
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || 'pcs'}
            </span>
          </div>
          {stockByCondition.totalStok > 0 && (
            <div className="mt-1 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Maks: {
                  formData.kondisi === 'BARU' ? stockByCondition.BARU :
                    formData.kondisi === 'BEKAS' ? stockByCondition.BEKAS :
                      formData.kondisi === 'RUSAK' ? stockByCondition.RUSAK :
                        stockByCondition.totalStok
                } {selectedBarang?.satuan || 'pcs'} (kondisi: {formData.kondisi})
              </p>
              {parseInt(formData.jumlah) > (
                formData.kondisi === 'BARU' ? stockByCondition.BARU :
                  formData.kondisi === 'BEKAS' ? stockByCondition.BEKAS :
                    formData.kondisi === 'RUSAK' ? stockByCondition.RUSAK :
                      stockByCondition.totalStok
              ) && (
                  <p className="text-xs text-red-600 font-medium">
                    ⚠️ Jumlah disesuaikan ke maksimal stock tersedia
                  </p>
                )}
              {(
                (formData.kondisi === 'BARU' && stockByCondition.BARU === 0) ||
                (formData.kondisi === 'BEKAS' && stockByCondition.BEKAS === 0) ||
                (formData.kondisi === 'RUSAK' && stockByCondition.RUSAK === 0)
              ) && (
                  <p className="text-xs text-red-600 font-medium">
                    ❌ Stock kondisi {formData.kondisi} = 0, input dinonaktifkan
                  </p>
                )}
            </div>
          )}
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
            <option value="BARU">🟢 Baru</option>
            <option value="BEKAS">🟡 Bekas</option>
            <option value="RUSAK">🔴 Rusak</option>
          </select>
          <div className="mt-1">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiColor(formData.kondisi)}`}>
              {formData.kondisi === 'BARU' && 'Baru - Siap pakai'}
              {formData.kondisi === 'BEKAS' && 'Bekas - Pernah dipakai'}
              {formData.kondisi === 'RUSAK' && 'Rusak - Perlu perbaikan'}
            </span>
          </div>
          {/* Checkbox for lost items */}
          <div className="mt-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isHilang}
                onChange={(e) => setFormData({ ...formData, isHilang: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                🟣 Barang Hilang (tidak ada fisiknya)
              </span>
            </label>
            {formData.isHilang && (
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">
                ⚠️ Barang ini ditandai sebagai hilang/tidak ditemukan
              </p>
            )}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tanggal
        </label>
        <input
          type="date"
          id="tanggal"
          value={formData.tanggal}
          onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tanggal tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      {/* Employee Fields */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Karyawan (Opsional)
          </label>
          <select
            id="employeeId"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading}
          >
            <option value="">Pilih karyawan</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.department}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tujuan Penggunaan (Opsional)
          </label>
          <input
            type="text"
            id="purpose"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Contoh: Proyek ABC, Maintenance, dll"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Keterangan
        </label>
        <textarea
          id="keterangan"
          value={formData.keterangan}
          onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Untuk pelanggan Pak Budi"
          disabled={loading}
        />
      </div>

      {/* Photo Upload Section */}
      {(!initialData || transactionId) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Foto Barang (Opsional)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {initialData
              ? 'Tambah foto barang untuk dokumentasi (maksimal 5 foto)'
              : 'Upload foto barang saat keluar untuk dokumentasi (maksimal 5 foto)'
            }
          </p>
          {initialData && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Mode Edit:</strong> Anda dapat menambahkan foto baru untuk transaksi ini.
              </p>
            </div>
          )}
          <PhotoUpload
            transactionId={transactionId || undefined}
            transactionType="inventory-keluar"
            onPhotosChange={setUploadedPhotos}
            maxPhotos={5}
            maxSizeMB={5}
            disabled={loading}
            className="border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}
          {initialData && !transactionId && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Perhatian:</strong> Data transaksi sedang dimuat. Foto dapat ditambahkan setelah data tersedia.
          </p>
        </div>
      )}

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
          disabled={loading || (!initialData && stockByCondition.totalStok === 0)}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Menyimpan...'
            : initialData
              ? 'Update & Upload Foto'
              : 'Simpan'
          }
        </button>
      </div>
    </form>
  )
}